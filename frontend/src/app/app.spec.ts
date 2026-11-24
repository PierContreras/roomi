import { HttpErrorResponse, HttpInterceptorFn, HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { App } from './app';
import { routes } from './app.routes';
import { Room, RoomDraft } from './interfaces/room';
import { demoRooms } from './services/demo-rooms';
import { RoomService } from './services/room.service';
import { SessionService } from './services/session.service';
import { UiLibraries } from './services/ui-libraries';

let managed: Room[];
const mockCatalog: HttpInterceptorFn = request => {
  const rooms = managed.filter(room => room.status === 'publicado');
  const { params, method, url } = request;
  expect(url.startsWith('/api/')).toBe(true);
  const ownerRoute = url.startsWith('/api/propietario/') ||
    (url.startsWith('/api/alojamientos') && ['PUT', 'PATCH', 'DELETE'].includes(method)) ||
    (url === '/api/alojamientos' && method === 'POST');
  if (ownerRoute || url.startsWith('/api/administracion/')) {
    expect(request.headers.get('Authorization')).toMatch(ownerRoute ? /^Bearer test-(owner|student)$/ : /^Bearer test-admin$/);
  } else if (url.endsWith('/contacto') || (url.endsWith('/consultas') && method === 'POST')) {
    expect(request.headers.get('Authorization')).toBe('Bearer test-student');
  } else if (url.startsWith('/api/auth/') || method === 'GET') {
    expect(request.headers.has('Authorization')).toBe(false);
  }
  const reply = (body: unknown) => of(new HttpResponse({ body }));
  if (url === '/api/auth/login' || url === '/api/auth/registro') {
    const data = request.body as { email: string; password: string; role?: string };
    if (url.endsWith('/registro')) expect(data.role).toBeUndefined();
    if (data.password === 'incorrecta') {
      return throwError(() => new HttpErrorResponse({ status: 401, error: { detail: 'El correo o la contraseña no coinciden.' } }));
    }
    if (data.email === 'servicio@roomi.test') {
      return throwError(() => new HttpErrorResponse({ status: 503, error: { detail: 'Configura el secreto de sesión en el servidor.' } }));
    }
    const owner = data.email.startsWith('propietario');
    const role = owner ? 'owner' : data.email.startsWith('administrador') ? 'admin' : 'student';
    return reply({ token: 'test-' + role, user: { id: 'demo-' + role, name: 'Cuenta Prueba', email: data.email, role } });
  }
  if (url === '/api/propietario/alojamientos') {
    const role = request.headers.get('Authorization')?.slice('Bearer test-'.length);
    return reply(managed.filter(room => room.ownerId === 'demo-' + role));
  }
  if (url === '/api/administracion/alojamientos') return reply(managed.filter(room => room.status === 'en_revision'));
  if (url === '/api/propietario/consultas') {
    return reply([{
      id: 'consulta-recibida', roomId: 'nuevo', title: 'Anuncio de prueba',
      name: 'Estudiante Prueba', whatsapp: '51912345678', email: null, message: 'Quisiera coordinar una visita.',
    }]);
  }
  if (url === '/api/administracion/reportes') return reply([]);
  if (url.endsWith('/contacto')) return reply({ whatsapp: '51987654321', formulario: true });
  if (url.endsWith('/resenas')) {
    if (method === 'POST') {
      expect(request.headers.get('Authorization')).toMatch(/^Bearer test-(student|owner)$/);
      expect(request.body).toMatchObject({ rating: 4 });
      return reply({ id: 'resena-prueba' });
    }
    return reply([]);
  }
  if (url.endsWith('/consultas') && method === 'POST') {
    expect(request.body).toMatchObject({ whatsapp: '51912345678', email: null, consent: true });
    return reply({ id: 'consulta-prueba' });
  }
  if (method === 'POST' && url === '/api/alojamientos') {
    managed = [{ ...(request.body as RoomDraft), id: 'nuevo', ownerId: 'demo-owner', owner: 'Cuenta Prueba', status: 'publicado', revision: 1 }, ...managed];
    return reply({ id: 'nuevo', status: 'publicado', motivos: [] });
  }
  const id = url.split('/')[3];
  if (method === 'POST' && url.endsWith('/reactivar')) {
    managed = managed.map(room => room.id === id ? { ...room, status: 'publicado' } : room);
    return reply({ id, status: 'publicado', motivos: [] });
  }
  if (method === 'DELETE') {
    managed = managed.filter(room => room.id !== id);
    return of(new HttpResponse({ status: 204 }));
  }
  if (method === 'PUT') {
    managed = managed.map(room => room.id === id ? { ...room, ...(request.body as RoomDraft), status: 'publicado' } : room);
    return reply({ id, status: 'publicado', motivos: [] });
  }
  if (method === 'PATCH') {
    const data = request.body as { status: Room['status']; note?: string };
    const target = url.startsWith('/api/administracion') ? url.split('/')[4] : id;
    managed = managed.map(room => room.id === target ? { ...room, status: data.status, reviewNote: data.note } : room);
    return reply(null);
  }
  if (url === '/api/alojamientos') {
    const results = rooms.filter(room =>
      (!params.has('zona') || room.zone === params.get('zona')) &&
      (!params.has('precio') || room.price <= Number(params.get('precio'))),
    );
    return of(new HttpResponse({ body: results }));
  }
  if (url === '/api/alojamientos/catalogo-no-disponible') {
    return throwError(() => new HttpErrorResponse({ status: 503, url }));
  }
  const room = rooms.find(room => url === `/api/alojamientos/${room.id}`);
  return room
    ? of(new HttpResponse({ body: room }))
    : throwError(() => new HttpErrorResponse({ status: 404, url }));
};

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [App], providers: [provideRouter([]), provideHttpClient()] }).compileComponents();
  });

  it('renders the site layout and opens and closes the mobile navigation', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('main#contenido')).toBeTruthy();
    expect(root.querySelector('footer')?.textContent).toContain('Huancayo');
    const menu = root.querySelector<HTMLButtonElement>('button[aria-controls="navegacion-movil"]')!;
    const drawer = root.querySelector<HTMLDialogElement>('#navegacion-movil')!;
    const close = drawer.querySelector<HTMLButtonElement>('.drawer-close')!;
    const last = [...drawer.querySelectorAll<HTMLElement>('a[href], button')].at(-1)!;
    // jsdom lacks the dialog API and runs this fixture at its default desktop width.
    menu.style.display = 'inline-flex';
    drawer.showModal = () => { drawer.open = true; drawer.style.display = 'block'; };
    drawer.close = () => { drawer.open = false; drawer.style.display = 'none'; };
    const open = () => {
      menu.click();
      fixture.detectChanges();
      expect(drawer.open).toBe(true);
      expect(menu.getAttribute('aria-expanded')).toBe('true');
      expect(document.activeElement).toBe(close);
    };
    const expectClosed = () => {
      fixture.detectChanges();
      expect(drawer.open).toBe(false);
      expect(menu.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(menu);
    };
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    expect(menu.getAttribute('aria-label')).toBe('Abrir menú');
    open();
    expect(menu.getAttribute('aria-label')).toBe('Cerrar menú');
    close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(last);
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(close);
    drawer.dispatchEvent(new Event('cancel', { cancelable: true }));
    expectClosed();
    open();
    drawer.dispatchEvent(new MouseEvent('click', { clientX: 500, clientY: 100, bubbles: true }));
    expectClosed();
    open();
    close.click();
    expectClosed();
  });
});

it('recupera la sesión antes de entrar a la misma ruta protegida y la borra al cerrar sesión', async () => {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
  const token = `cabecera.${payload}.firma`;
  const user = { id: 'cuenta', name: 'Cuenta de prueba', email: 'prueba@roomi.test', role: 'student' };
  const http: HttpInterceptorFn = request => {
    if (request.url === '/api/auth/login') return of(new HttpResponse({ body: { token, user } }));
    expect(request.headers.get('Authorization')).toBe('Bearer ' + token);
    return throwError(() => new HttpErrorResponse({ status: 503 }));
  };
  const configure = () => TestBed.configureTestingModule({ providers: [
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([http])),
  ] });

  sessionStorage.removeItem('roomi.session.v1');
  try {
    configure();
    await TestBed.inject(SessionService).signIn(user.email, 'clave-de-prueba');
    TestBed.resetTestingModule();
    configure();

    const url = '/propietario/nuevo?origen=panel';
    const harness = await RouterTestingHarness.create(url);
    expect(TestBed.inject(Router).url).toBe(url);
    expect(harness.routeNativeElement?.textContent).toContain('Publicar habitación');
    const session = TestBed.inject(SessionService);
    expect(session.user()).toEqual(user);
    session.signOut();
    expect(sessionStorage.getItem('roomi.session.v1')).toBeNull();
  } finally {
    sessionStorage.removeItem('roomi.session.v1');
  }
});

describe('Recorridos de ROOMI', () => {
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    managed = demoRooms.map(room => ({
      ...room, contactAvailable: true, revision: 1,
      ...(room.id === 'san-carlos-320' ? { latitude: 0, longitude: 0 } : {}),
    }));
    localStorage.removeItem('roomi.saved.v1');
    TestBed.configureTestingModule({ providers: [
      provideRouter(routes, withComponentInputBinding()),
      provideHttpClient(withInterceptors([mockCatalog])),
    ] });
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => vi.restoreAllMocks());

  function page() {
    return harness.routeNativeElement!;
  }

  function text() {
    return page().textContent ?? '';
  }

  async function stabilize() {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  async function action(label: string) {
    const item = await vi.waitFor(async () => {
      await stabilize();
      const result = [...page().querySelectorAll<HTMLButtonElement | HTMLAnchorElement>('button, a')]
        .find(element => element.textContent?.trim().startsWith(label));
      expect(result, label).toBeDefined();
      return result!;
    });
    item.click();
    await stabilize();
    await vi.waitFor(async () => {
      await stabilize();
      expect(page().querySelector('button:disabled')?.textContent ?? '').not.toMatch(/Procesando|Guardando|Enviando/);
    });
  }

  async function enter(name: string, value: string) {
    const field = page().querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[name="${name}"]`)!;
    expect(field, name).toBeTruthy();
    field.value = value;
    field.dispatchEvent(new Event(field.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    await stabilize();
  }

  async function chooseProfile(label: string) {
    await harness.navigateByUrl('/acceso');
    const email = label === 'Propietario' ? 'propietario@roomi.test' : 'administrador@roomi.test';
    await enter('correo', email);
    await enter('contrasena', 'solo-pruebas-123');
    await action('Iniciar sesión');
    if (label === 'Propietario') await harness.navigateByUrl('/propietario');
    await vi.waitFor(async () => {
      await stabilize();
      expect(TestBed.inject(Router).url).toBe(label === 'Propietario' ? '/propietario' : '/administracion');
    });
  }

  it('busca, filtra, guarda un anuncio y envía una consulta', async () => {
    await harness.navigateByUrl('/explorar');
    expect(page().querySelector('h1')?.textContent).toContain('cerca de tu universidad en Huancayo');
    expect(page().querySelector('#steps-title')?.textContent).toBe('Cómo funciona');
    expect(page().querySelector('#rooms-title')?.textContent).toBe('Habitaciones destacadas');
    expect(page().querySelector('a[href="/propietario/nuevo"]')?.textContent).toContain('publicar anuncio');
    await action('San Carlos');
    expect(TestBed.inject(Router).parseUrl(TestBed.inject(Router).url).queryParamMap.get('zona')).toBe('San Carlos');
    expect(page().querySelector('[aria-label="Filtros aplicados"]')?.textContent).toContain('San Carlos');
    await harness.navigateByUrl('/explorar');
    await enter('zona', 'San Carlos');
    await action('Buscar habitaciones');
    await stabilize();
    expect(text()).toContain('2 habitaciones encontradas');

    await action('Filtros: precio');
    await enter('precio', '10');
    await action('Aplicar filtros');
    await stabilize();
    expect(text()).toContain('No encontramos habitaciones con estos filtros');

    await enter('precio', '325');
    await enter('distancia', '4');
    await action('Aplicar filtros');
    await stabilize();
    expect(text()).toContain('1 habitación encontrada');
    await action('Comparar precios');
    expect(page().querySelector('table tbody')?.textContent).toMatch(/San Carlos.*320.*320/);
    await action('Ver mapa');
    expect(page().querySelector('.map-open')).toBeTruthy();
    expect(page().querySelector('.map-caption')?.textContent).toContain('Ubicación aproximada');
    expect(page().querySelector('app-room-map a[href^="https://www.google.com/maps/"]')).toBeNull();
    await action('Ubicar en el mapa');
    expect(page().querySelector('.map-preview')?.textContent).toContain('Cuarto iluminado');
    expect(page().querySelector('.map-preview')?.textContent).toContain('Ubicación aproximada');
    const mapsLink = page().querySelector<HTMLAnchorElement>('.map-preview a[href^="https://www.google.com/maps/"]');
    expect(new URL(mapsLink!.href).searchParams.get('query')).toBe('San Carlos, Huancayo, Perú');
    expect(page().querySelector('.result-card.selected')?.getAttribute('data-room-id')).toBe('san-carlos-320');
    await action('Ver listado');
    await action('Guardar');
    expect(TestBed.inject(RoomService).isSaved('san-carlos-320')).toBe(true);
    await action('Ver anuncio');
    expect(text()).toContain('Cuarto iluminado con escritorio y baño propio');
    expect(page().querySelector('a[href^="https://wa.me/"]')).toBeNull();
    await action('Contactar propietario');
    expect(text()).toContain('Entra a tu cuenta de ROOMI para contactar');
    expect(TestBed.inject(Router).parseUrl(TestBed.inject(Router).url).queryParamMap.get('retorno')).toContain('/habitaciones/san-carlos-320/contacto');
    await enter('correo', 'consulta@roomi.test');
    await enter('contrasena', 'solo-pruebas-123');
    await action('Iniciar sesión');
    await vi.waitFor(async () => {
      await stabilize();
      expect(TestBed.inject(Router).url).toContain('/habitaciones/san-carlos-320/contacto');
      expect(page().querySelector('a[href^="https://wa.me/51987654321"]')).toBeNull();
    });
    await action('Enviar consulta');
    expect(text()).toContain('Revisa los campos');
    await enter('nombre', 'Estudiante Prueba');
    await enter('whatsapp', '912 345 678');
    await enter('mensaje', '¿Puedo visitar la habitación el sábado?');
    page().querySelector<HTMLInputElement>('[name="consentimiento"]')!.click();
    await stabilize();
    await action('Enviar consulta');
    await vi.waitFor(async () => {
      await stabilize();
      expect(text()).toContain('Consulta enviada');
      expect(page().querySelector('a[href^="https://wa.me/51987654321"]')).toBeTruthy();
    });
    await action('Volver al anuncio');
    await action('← Volver a los resultados');
    const params = TestBed.inject(Router).parseUrl(TestBed.inject(Router).url).queryParamMap;
    expect(params.get('zona')).toBe('San Carlos');
    expect(params.get('precio')).toBe('325');
    expect(params.get('distancia')).toBe('4');
    await stabilize();
    expect(text()).toContain('1 habitación encontrada');
  });

  it('ordena los resultados y compara los anuncios guardados', async () => {
    await harness.navigateByUrl('/buscar?zona=San%20Carlos&precio=1000');
    await stabilize();
    await enter('orden', 'precio');
    const prices = [...page().querySelectorAll('.price strong')].map(item => Number(item.textContent?.replace('S/', '').trim()));
    expect(prices).toHaveLength(2);
    expect(prices).toEqual([...prices].sort((left, right) => left - right));
    page().querySelector<HTMLAnchorElement>('a[aria-label="Quitar filtro: Hasta S/ 1000"]')!.click();
    await stabilize();
    const params = TestBed.inject(Router).parseUrl(TestBed.inject(Router).url).queryParamMap;
    expect(params.get('precio')).toBeNull();
    expect(params.get('zona')).toBe('San Carlos');
    expect(params.get('orden')).toBe('precio');
    for (const button of page().querySelectorAll<HTMLButtonElement>('.favorite')) {
      button.click();
    }
    await harness.navigateByUrl('/guardados');
    await stabilize();
    await action('Comparar habitaciones');
    const table = page().querySelector('table')!;
    expect(table.textContent).toContain('Garantía');
    expect(table.querySelectorAll('thead th')).toHaveLength(3);
    await action('Ver anuncio');
    await action('← Volver a guardados');
    expect(TestBed.inject(Router).url).toMatch(/^\/guardados\?comparar=/);
    expect(page().querySelector('table')?.textContent).toContain('Garantía');
  });

  it('distingue un anuncio inexistente de un fallo del catálogo', async () => {
    await harness.navigateByUrl('/habitaciones/no-existe');
    await stabilize();
    expect(text()).toContain('Habitación no disponible');

    await harness.navigateByUrl('/habitaciones/catalogo-no-disponible');
    await stabilize();
    expect(page().querySelector('[role="alert"]')?.textContent).toContain('No pudimos cargar el anuncio');
  });

  it('valida el acceso y confirma el registro de un perfil ficticio', async () => {
    await harness.navigateByUrl('/');
    expect(TestBed.inject(Router).url).toBe('/explorar');
    await harness.navigateByUrl('/acceso');
    expect(text()).toContain('Inicia sesión en ROOMI');
    await action('Seguir explorando como invitado');
    expect(TestBed.inject(Router).url).toBe('/explorar');
    await harness.navigateByUrl('/propietario');
    expect(TestBed.inject(Router).url).toBe('/acceso');
    await action('Iniciar sesión');
    expect(text()).toContain('Escribe tu correo electrónico.');
    expect(text()).toContain('Escribe tu contraseña.');
    await enter('correo', 'usuario@correo');
    await action('Iniciar sesión');
    expect(text()).toContain('Escribe un correo válido');
    await enter('correo', 'propietario@roomi.test');
    await enter('contrasena', 'incorrecta');
    await action('Iniciar sesión');
    expect(text()).toContain('El correo o la contraseña son incorrectos.');
    await harness.navigateByUrl('/registro');
    expect(page().querySelector('[name="rol"]')).toBeNull();
    await enter('nombre', 'Cuenta Prueba');
    await enter('correo', 'nueva@roomi.test');
    await enter('contrasena', 'prueba12345');
    expect(page().querySelector<HTMLInputElement>('[name="contrasena"]')?.type).toBe('password');
    expect(page().querySelector('[aria-label="Mostrar contraseña"] .bi-eye-slash')).toBeTruthy();
    page().querySelector<HTMLButtonElement>('[aria-label="Mostrar contraseña"]')?.click();
    await stabilize();
    expect(page().querySelector<HTMLInputElement>('[name="contrasena"]')?.type).toBe('text');
    expect(page().querySelector('[aria-label="Ocultar contraseña"] .bi-eye')).toBeTruthy();
    page().querySelector<HTMLButtonElement>('[aria-label="Ocultar contraseña"]')?.click();
    await stabilize();
    expect(page().querySelector<HTMLInputElement>('[name="contrasena"]')?.type).toBe('password');
    await enter('confirmacion', 'otra-clave12345');
    await action('Crear cuenta');
    expect(text()).toContain('Las contraseñas deben coincidir.');
    await enter('confirmacion', 'prueba12345');
    await enter('correo', 'servicio@roomi.test');
    await action('Crear cuenta');
    expect(text()).toContain('Vuelve a intentar crear tu cuenta más tarde.');
    expect(text()).not.toContain('Configura el secreto');
    await enter('correo', 'nueva@roomi.test');
    expect(text()).not.toContain('Vuelve a intentar crear tu cuenta más tarde.');
    await action('Crear cuenta');
    await vi.waitFor(async () => {
      await stabilize();
      expect(TestBed.inject(Router).url).toBe('/explorar');
    });
    await harness.navigateByUrl('/habitaciones/san-carlos-320');
    await action('Escribir reseña');
    await enter('comentario', 'Comentario de prueba de la habitación.');
    await action('Publicar reseña');
    expect(text()).toContain('Selecciona de 1 a 5 estrellas.');
    page().querySelector<HTMLInputElement>('[aria-label="4 estrellas"]')!.click();
    await stabilize();
    await action('Publicar reseña');
    expect(text()).toContain('Reseña publicada.');
    await harness.navigateByUrl('/propietario/nuevo');
    expect(text()).toContain('Publicar habitación');
  });

  it('busca preguntas de ayuda y confirma una consulta simulada', async () => {
    await harness.navigateByUrl('/ayuda');
    await enter('busqueda', 'propietario');
    await action('Buscar');
    expect(text()).toContain('resultados para');
    await action('Registrar consulta de prueba');
    expect(text()).toContain('Revisa tu consulta');
    await enter('nombre', 'Juan Demo');
    await enter('correo', 'ayuda@roomi.test');
    await enter('motivo', 'Otra consulta');
    await enter('mensaje', 'Quiero conocer cómo funciona el directorio.');
    await action('Registrar consulta de prueba');
    expect(text()).toContain('Consulta registrada en la demo');
  });

  it('abre la pantalla de compartir desde la habitación', async () => {
    await harness.navigateByUrl('/habitaciones/san-carlos-320');
    await stabilize();
    await action('Compartir anuncio');
    expect(text()).toContain('Comparte este anuncio');
    expect(page().querySelector('input')?.value).toMatch(/\/habitaciones\/san-carlos-320$/);
    await action('Volver al anuncio');
    expect(text()).toContain('Sobre la habitación');
  });

  it('crea, edita, pausa, reactiva y elimina un anuncio y refleja ambas decisiones de moderación', async () => {
    vi.spyOn(TestBed.inject(UiLibraries), 'confirm').mockResolvedValue(undefined);
    vi.spyOn(TestBed.inject(UiLibraries), 'success').mockResolvedValue(undefined);
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag, options) => {
      const element = createElement(tag, options);
      if (tag === 'dialog' && !('showModal' in element)) {
        Object.assign(element, {
          showModal: () => element.setAttribute('open', ''),
          close: () => {
            element.removeAttribute('open');
            element.dispatchEvent(new Event('close'));
          },
        });
      }
      return element;
    });
    await chooseProfile('Propietario');
    await vi.waitFor(async () => {
      await stabilize();
      expect(text()).toContain('En revisión');
    });
    expect(text()).toContain('Publicado');
    expect(text()).toContain('Rechazado');
    expect(page().querySelector('a[href^="https://wa.me/51912345678"]')?.textContent).toContain('Responder por WhatsApp');
    await action('Publicar anuncio');
    await action('Revisar publicación');
    expect(text()).toContain('Escribe el título del anuncio.');
    await enter('titulo', 'Habitación de prueba');
    await enter('direccion', 'Pasaje de prueba 10');
    const map = {
      setView: vi.fn(), on: vi.fn(), remove: vi.fn(),
      getCenter: () => ({ lat: -12.06, lng: -75.21 }),
    };
    const marker = { setOpacity: vi.fn(), setLatLng: vi.fn() };
    const libraries = TestBed.inject(UiLibraries);
    vi.spyOn(libraries, 'leaflet').mockResolvedValue({
      map: () => map,
      tileLayer: () => ({ addTo: () => ({ on: vi.fn() }) }),
      divIcon: vi.fn(),
      marker: () => ({ addTo: () => marker }),
    } as unknown as Awaited<ReturnType<UiLibraries['leaflet']>>);
    await action('Elegir ubicación en el mapa');
    await action('Marcar el centro del mapa');
    expect(text()).toContain('Ubicación seleccionada.');
    await enter('distancia', '1.2');
    await enter('precio', '430');
    await enter('garantia', '100');
    await enter('minutos', '13');
    await enter('descripcion', 'Cuarto de prueba con luz natural.');
    await enter('condiciones', 'Coordinar una visita de prueba.');
    await action('Revisar publicación');
    expect(text()).toContain('Revisa tu publicación');
    await action('Publicar anuncio');
    expect(text()).toContain('Anuncio publicado');
    expect(page().querySelector('a[href="/habitaciones/nuevo"]')?.textContent).toContain('Ver anuncio publicado');
    await harness.navigateByUrl('/habitaciones/nuevo');
    await stabilize();
    expect(text()).toContain('Habitación de prueba');
    await harness.navigateByUrl('/propietario');
    await action('Editar Habitación de prueba');
    await enter('precio', '410');
    await action('Revisar publicación');
    await action('Guardar cambios');
    await action('Ver mis anuncios');
    expect(text()).toContain('S/ 410 / mes');

    const legacyPending = managed.find(room => room.id === 'chilca-en-revision')!;
    managed = [...managed, { ...legacyPending, id: 'anuncio-pendiente-anterior', title: 'Anuncio pendiente anterior' }];
    await chooseProfile('Administrador');
    await action('Revisar anuncio Anuncio pendiente anterior');
    await action('Rechazar anuncio');
    expect(text()).toContain('Escribe el motivo');
    await enter('motivo', 'Añade referencias para ubicar el alojamiento.');
    await action('Rechazar anuncio');
    await vi.waitFor(async () => {
      await stabilize();
      expect(text()).toContain('Anuncio rechazado');
    });
    await action('Volver a la cola');
    await action('Revisar anuncio Habitación independiente en Chilca');
    await enter('motivo', 'Cumple las reglas de la publicación.');
    await action('Aprobar anuncio');
    await vi.waitFor(async () => {
      await stabilize();
      expect(text()).toContain('Anuncio aprobado.');
    });
    expect(managed.find(room => room.id === 'chilca-en-revision')?.status).toBe('publicado');

    await chooseProfile('Propietario');
    expect(text()).toContain('Añade referencias para ubicar el alojamiento.');
    const room = [...page().querySelectorAll('article')].find(item => item.textContent?.includes('Habitación independiente en Chilca'));
    expect(room?.textContent).toContain('Publicado');
    await action('Retirar Habitación de prueba');
    expect(page().querySelector('dialog')?.open).toBe(true);
    expect(text()).toContain('¿Quieres retirar «Habitación de prueba»');
    await action('Cancelar');
    expect(page().querySelector('dialog')?.open).toBe(false);
    await action('Retirar Habitación de prueba');
    await action('Retirar anuncio');
    await vi.waitFor(async () => {
      await stabilize();
      expect(text()).toContain('Publicación retirada');
      expect(text()).toContain('Retirado');
    });
    const retired = [...page().querySelectorAll('article')].find(item => item.textContent?.includes('Habitación de prueba'));
    expect(retired?.textContent).toContain('Retirado');
    expect([...retired!.querySelectorAll('button')].some(button => button.textContent.includes('Eliminar'))).toBe(true);
    await action('Reactivar Habitación de prueba');
    expect(managed.find(item => item.id === 'nuevo')?.status).toBe('publicado');
    await action('Eliminar Habitación de prueba');
    await action('Eliminar anuncio');
    await vi.waitFor(async () => {
      await stabilize();
      expect(text()).toContain('Publicación eliminada.');
      expect(text()).not.toContain('Habitación de prueba');
    });
  });
});

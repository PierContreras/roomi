import { HttpErrorResponse, HttpInterceptorFn, HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { environment } from '../environments/environment';
import { App } from './app';
import { routes } from './app.routes';
import { Room, RoomDraft } from './interfaces/room';
import { demoRooms } from './services/demo-rooms';
import { RoomService } from './services/room.service';
import { SessionService } from './services/session.service';
import { UiLibraries } from './services/ui-libraries';

let managed: Room[];
const reports = new Set<string>();
const mockCatalog: HttpInterceptorFn = request => {
  const rooms = managed.filter(room => room.status === 'publicado' && !room.ocupado);
  const { params, method } = request;
  expect(request.url.startsWith(environment.apiUrl + '/')).toBe(true);
  const url = new URL(request.url, 'http://localhost:4200').pathname;
  expect(url.startsWith('/api/')).toBe(true);
  const ownerRoute = url.startsWith('/api/propietario/') ||
    (url.startsWith('/api/alojamientos') && ['PUT', 'PATCH', 'DELETE'].includes(method)) ||
    (url === '/api/alojamientos' && method === 'POST');
  if (ownerRoute) {
    expect(request.headers.get('Authorization')).toMatch(/^Bearer test-(owner|student)$/);
  } else if (url.endsWith('/contacto')) {
    expect(request.headers.get('Authorization')).toMatch(/^Bearer test-(owner|student)$/);
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
    const fixture = owner ? 'owner' : 'student';
    return reply({ token: 'test-' + fixture, user: { id: 'demo-' + fixture, name: 'Cuenta Prueba', email: data.email, role: 'user' } });
  }
  if (url === '/api/propietario/alojamientos') {
    const fixture = request.headers.get('Authorization')?.slice('Bearer test-'.length);
    return reply(managed.filter(room => room.ownerId === 'demo-' + fixture));
  }
  if (url.endsWith('/contacto')) return reply({ whatsapp: '51987654321' });
  if (url.endsWith('/reportes') && method === 'POST') {
    expect(request.headers.get('Authorization')).toBe('Bearer test-student');
    expect(request.body).toEqual({ message: 'El precio anunciado parece incorrecto.' });
    if (reports.has(url)) return throwError(() => new HttpErrorResponse({ status: 409 }));
    reports.add(url);
    return reply({ id: 'reporte-prueba' });
  }
  if (url.endsWith('/resenas')) {
    if (method === 'POST') {
      expect(request.headers.get('Authorization')).toMatch(/^Bearer test-(student|owner)$/);
      expect(request.body).toMatchObject({ rating: 4 });
      return reply({ id: 'resena-prueba' });
    }
    if (url === '/api/alojamientos/san-carlos-320/resenas') {
      return reply([
        { id: 'r1', name: 'Ana', rating: 5, message: 'Hay espacio para estudiar.' },
        { id: 'r2', name: 'Luis', rating: 3, message: 'La descripción coincide con el anuncio.' },
      ]);
    }
    return reply([]);
  }
  if (method === 'POST' && url === '/api/alojamientos') {
    if ((request.body as RoomDraft).price === 430) {
      return throwError(() => new HttpErrorResponse({
        status: 422, error: { detail: 'Corrige el precio antes de publicar.' },
      }));
    }
    managed = [{ ...(request.body as RoomDraft), id: 'nuevo', ownerId: 'demo-owner', owner: 'Cuenta Prueba', status: 'publicado' }, ...managed];
    return reply({ id: 'nuevo', status: 'publicado' });
  }
  const id = url.split('/')[3];
  if (method === 'POST' && url.endsWith('/reactivar')) {
    managed = managed.map(room => room.id === id ? { ...room, status: 'publicado' } : room);
    return reply({ id, status: 'publicado' });
  }
  if (method === 'DELETE') {
    managed = managed.filter(room => room.id !== id);
    return of(new HttpResponse({ status: 204 }));
  }
  if (method === 'PUT') {
    managed = managed.map(room => room.id === id ? { ...room, ...(request.body as RoomDraft), status: 'publicado' } : room);
    return reply({ id, status: 'publicado' });
  }
  if (method === 'PATCH') {
    if (url.endsWith('/disponibilidad')) {
      const { ocupado } = request.body as { ocupado: boolean };
      managed = managed.map(room => room.id === url.split('/')[4] ? { ...room, ocupado } : room);
      return reply(null);
    }
    const { status } = request.body as { status: Room['status'] };
    managed = managed.map(room => room.id === id ? { ...room, status } : room);
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

  it('muestra la cuenta y devuelve el foco al cerrar el menú con Escape', async () => {
    vi.spyOn(TestBed.inject(SessionService), 'user').mockReturnValue({
      id: 'cuenta', name: 'Cuenta de prueba', email: 'prueba@roomi.test', role: 'user',
    });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const account = root.querySelector<HTMLDetailsElement>('.desktop-nav .account')!;
    const trigger = account.querySelector('summary')!;
    account.open = true;
    expect(account.querySelector('.account-name')?.textContent).toContain('Cuenta de prueba');
    expect(account.querySelector('.account-initial')?.textContent?.trim()).toBe('C');
    expect(account.querySelector('a[href="/propietario#consultas"]')).toBeNull();
    const action = account.querySelector<HTMLButtonElement>('.account-action')!;
    action.focus();
    action.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(account.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });
});

it('recupera la sesión antes de entrar a la misma ruta protegida y la borra al cerrar sesión', async () => {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
  const token = `cabecera.${payload}.firma`;
  const user = { id: 'cuenta', name: 'Cuenta de prueba', email: 'prueba@roomi.test', role: 'user' };
  const http: HttpInterceptorFn = request => {
    if (request.url === `${environment.apiUrl}/auth/login`) return of(new HttpResponse({ body: { token, user } }));
    expect(request.headers.get('Authorization')).toBe('Bearer ' + token);
    return throwError(() => new HttpErrorResponse({ status: 503 }));
  };
  const configure = () => TestBed.configureTestingModule({ providers: [
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([http])),
  ] });

  const key = 'roomi.session.v1';
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
  try {
    configure();
    await TestBed.inject(SessionService).signIn(user.email, 'clave-de-prueba');
    expect(localStorage.getItem(key)).toBe(JSON.stringify({ token, user }));
    expect(sessionStorage.getItem(key)).toBeNull();
    sessionStorage.setItem(key, JSON.stringify({ token, user: { ...user, role: 'student' } }));
    localStorage.removeItem(key);
    TestBed.resetTestingModule();
    configure();

    const url = '/propietario/nuevo?origen=panel';
    const harness = await RouterTestingHarness.create(url);
    expect(TestBed.inject(Router).url).toBe(url);
    expect(harness.routeNativeElement?.textContent).toContain('Publicar habitación');
    const session = TestBed.inject(SessionService);
    expect(session.user()).toEqual(user);
    expect(localStorage.getItem(key)).toBe(JSON.stringify({ token, user }));
    expect(sessionStorage.getItem(key)).toBeNull();
    session.signOut();
    expect(localStorage.getItem(key)).toBeNull();
    expect(sessionStorage.getItem(key)).toBeNull();
  } finally {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
});

describe('Recorridos de ROOMI', () => {
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    reports.clear();
    localStorage.removeItem('roomi.session.v1');
    managed = demoRooms.map(room => ({
      ...room, contactAvailable: true,
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

  async function signInAsOwner() {
    await harness.navigateByUrl('/acceso');
    await enter('correo', 'propietario@roomi.test');
    await enter('contrasena', 'solo-pruebas-123');
    await action('Iniciar sesión');
    await harness.navigateByUrl('/propietario');
    await vi.waitFor(async () => {
      await stabilize();
      expect(TestBed.inject(Router).url).toBe('/propietario');
    });
  }

  it('busca, filtra, guarda un anuncio y abre el contacto por WhatsApp', async () => {
    managed = managed.map(room => room.id === 'san-carlos-320' ? {
      ...room, photos: [{ src: '/foto-uno.jpg', alt: 'Habitación' }, { src: '/foto-dos.jpg', alt: 'Escritorio' }],
    } : room);
    await harness.navigateByUrl('/explorar');
    expect(page().querySelector('h1')?.textContent).toContain('cerca de tu universidad en Huancayo');
    expect(page().querySelector('#steps-title')?.textContent).toBe('Cómo funciona');
    expect(page().querySelector('#rooms-title')?.textContent).toBe('Habitaciones destacadas');
    expect(page().querySelector('a[href="/propietario/nuevo"]')?.textContent).toContain('publicar anuncio');
    expect(page().querySelectorAll('[name="zona"]')).toHaveLength(1);
    await enter('zona', 'San Carlos');
    await action('Buscar habitaciones');
    await stabilize();
    expect(TestBed.inject(Router).parseUrl(TestBed.inject(Router).url).queryParamMap.get('zona')).toBe('San Carlos');
    expect(page().querySelector('[aria-label="Filtros aplicados"]')?.textContent).toContain('San Carlos');
    expect(text()).toContain('2 habitaciones encontradas');

    await action('Más filtros');
    await enter('precio', '10');
    await action('Aplicar filtros');
    await stabilize();
    expect(text()).toContain('No encontramos habitaciones con estos filtros');

    await enter('precio', '325');
    await enter('distancia', '4');
    await action('Aplicar filtros');
    await stabilize();
    expect(text()).toContain('1 habitación encontrada');
    expect((page().querySelector('select[name="zona"]') as HTMLSelectElement).value).toBe('San Carlos');
    page().querySelector<HTMLButtonElement>('[aria-label="Foto siguiente"]')!.click();
    await stabilize();
    expect(page().querySelector('.photo-count')?.textContent).toContain('Foto 2 de 2');
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
    const listingLink = page().querySelector<HTMLAnchorElement>('.card-actions a')!;
    expect(listingLink.target).toBe('_blank');
    expect(listingLink.textContent).toContain('abre en otra pestaña');
    await harness.navigateByUrl(listingLink.pathname + listingLink.search);
    await stabilize();
    expect(page().querySelectorAll('.page-back a')).toHaveLength(1);
    expect(text()).toContain('Cuarto iluminado con escritorio y baño propio');
    expect(page().querySelector('.review-average strong')?.textContent).toBe('4');
    expect(page().querySelectorAll('.review-distribution li')).toHaveLength(5);
    expect(page().querySelectorAll('.review-card')).toHaveLength(2);
    expect(page().querySelector<HTMLDetailsElement>('#resenas details')?.open).toBe(false);
    expect(page().querySelector('#propietario h3')).toBeTruthy();
    expect(page().querySelectorAll('.listing-contact-action')).toHaveLength(1);
    expect(page().querySelector('.related-link')).toBeNull();
    expect(page().querySelector('#servicios app-ui-icon')).toBeTruthy();
    page().querySelector<HTMLButtonElement>('[aria-label="Ver foto 2: Escritorio"]')!.click();
    await stabilize();
    expect(page().querySelector('app-room-gallery .featured')?.getAttribute('alt')).toBe('Escritorio');
    expect(page().querySelector('[aria-label="Ver foto 2: Escritorio"]')?.getAttribute('aria-pressed')).toBe('true');
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
      const link = page().querySelector<HTMLAnchorElement>('a[href^="https://wa.me/51987654321"]')!;
      expect(new URL(link.href).searchParams.get('text')).toContain('¿Podríamos coordinar una visita?');
      expect(page().querySelector('form')).toBeNull();
    });
    await action('← Volver al anuncio');
    await vi.waitFor(async () => {
      await stabilize();
      expect(page().querySelector('.listing-contact-action[href^="https://wa.me/51987654321"]')).toBeTruthy();
    });
    for (const expected of ['Reporte registrado.', 'Ya reportaste este anuncio.']) {
      await action('Reportar anuncio');
      await enter('comentario', 'El precio anunciado parece incorrecto.');
      await action('Enviar reporte');
      expect(text()).toContain(expected);
      expect(text()).toContain('Cuarto iluminado con escritorio y baño propio');
    }
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
    const comparisonLink = table.querySelector<HTMLAnchorElement>('a[target="_blank"]')!;
    await harness.navigateByUrl(comparisonLink.pathname + comparisonLink.search);
    await stabilize();
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
    expect(page().querySelector('[aria-label="Mostrar contraseña"] app-ui-icon')).toBeTruthy();
    page().querySelector<HTMLButtonElement>('[aria-label="Mostrar contraseña"]')?.click();
    await stabilize();
    expect(page().querySelector<HTMLInputElement>('[name="contrasena"]')?.type).toBe('text');
    expect(page().querySelector('[aria-label="Ocultar contraseña"] app-ui-icon')).toBeTruthy();
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
    await action('Revisar consulta');
    expect(text()).toContain('Revisa tu consulta');
    await enter('nombre', 'Juan Demo');
    await enter('correo', 'ayuda@roomi.test');
    await enter('motivo', 'Otra consulta');
    await enter('mensaje', 'Quiero conocer cómo funciona el directorio.');
    await action('Revisar consulta');
    expect(text()).toContain('Vista previa completada');
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

  it('crea, edita, pausa, reactiva y elimina un anuncio con validación de publicación', async () => {
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
    await signInAsOwner();
    await vi.waitFor(async () => {
      await stabilize();
      expect(text()).toContain('Borrador');
    });
    expect(text()).toContain('Publicado');
    expect(text()).not.toContain('Consultas recibidas');
    await action('Publicar anuncio');
    expect(document.querySelector('app-site-header')).toBeNull();
    await action('Usar referencia de San Carlos');
    expect(page().querySelector<HTMLInputElement>('input[name="direccion"]')?.value).toBe('San Carlos, Huancayo');
    await action('Continuar');
    expect(text()).toContain('Ingresa una distancia entre 0 y 100 km.');
    await enter('direccion', 'Pasaje de prueba 10');
    await action('Guardar avance y salir');
    expect(TestBed.inject(Router).url).toBe('/propietario');
    await action('Publicar anuncio');
    expect(page().querySelector<HTMLInputElement>('input[name="direccion"]')?.value).toBe('Pasaje de prueba 10');
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
    await action('Continuar');
    await action('Continuar');
    expect(text()).toContain('Escribe el título del anuncio.');
    await enter('titulo', 'Habitación de prueba');
    await enter('precio', '430');
    await enter('garantia', '100');
    await enter('minutos', '13');
    await enter('descripcion', 'Cuarto de prueba con luz natural.');
    await enter('condiciones', 'Coordinar una visita de prueba.');
    await action('Continuar');
    expect(text()).toContain('Escribe un número de WhatsApp válido.');
    await enter('whatsapp', '987 000 000');
    await action('Continuar');
    await action('Atrás');
    expect(page().querySelector<HTMLInputElement>('input[name="titulo"]')?.value).toBe('Habitación de prueba');
    await action('Continuar');
    await action('Revisar publicación');
    expect(text()).toContain('Revisa tu publicación');
    await action('Publicar anuncio');
    expect(text()).toContain('Agrega una foto para publicar el anuncio.');
    const photos = page().querySelector<HTMLInputElement>('input[name="fotos"]')!;
    expect(document.activeElement).toBe(photos);
    Object.defineProperty(photos, 'files', { value: [new File(['foto'], 'habitacion.png', { type: 'image/png' })] });
    photos.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(async () => {
      await stabilize();
      expect(text()).toContain('Quitar foto 1');
    });
    await action('Revisar publicación');
    await action('Publicar anuncio');
    expect(text()).toContain('Corrige el precio antes de publicar.');
    await action('Editar alojamiento');
    await enter('precio', '435');
    await action('Continuar');
    await action('Revisar publicación');
    await action('Publicar anuncio');
    expect(text()).toContain('Anuncio publicado');
    expect(page().querySelector('a[href="/habitaciones/nuevo"]')?.textContent).toContain('Ver anuncio publicado');
    await harness.navigateByUrl('/habitaciones/nuevo');
    await stabilize();
    expect(text()).toContain('Habitación de prueba');
    await harness.navigateByUrl('/propietario');
    await action('Editar Habitación de prueba');
    await action('Continuar');
    await enter('precio', '410');
    await action('Continuar');
    await action('Revisar publicación');
    await action('Guardar cambios');
    await action('Ver mis anuncios');
    expect(text()).toContain('S/ 410 / mes');
    await action('Marcar ocupada Habitación de prueba');
    expect(text()).toContain('Habitación marcada como ocupada.');
    expect(managed.find(item => item.id === 'nuevo')?.ocupado).toBe(true);
    await action('Marcar disponible Habitación de prueba');
    expect(managed.find(item => item.id === 'nuevo')?.ocupado).toBe(false);

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

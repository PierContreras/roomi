import { HttpErrorResponse, HttpInterceptorFn, HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { App } from './app';
import { routes } from './app.routes';
import { demoRooms } from './services/demo-rooms';
import { RoomService } from './services/room.service';

const mockCatalog: HttpInterceptorFn = request => {
  const rooms = demoRooms.filter(room => room.status === 'approved');
  const { params, url } = request;
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
    await TestBed.configureTestingModule({ imports: [App], providers: [provideRouter([])] }).compileComponents();
  });

  it('renders the site layout and opens and closes the mobile navigation', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('main#contenido')).toBeTruthy();
    expect(root.querySelector('footer')?.textContent).toContain('Huancayo');
    const menu = root.querySelector<HTMLButtonElement>('button[aria-controls="navegacion"]')!;
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    menu.click();
    fixture.detectChanges();
    expect(menu.getAttribute('aria-expanded')).toBe('true');
    menu.click();
    fixture.detectChanges();
    expect(menu.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('Recorridos de ROOMI', () => {
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    localStorage.removeItem('roomi.rooms.v1');
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
    const item = [...page().querySelectorAll<HTMLButtonElement | HTMLAnchorElement>('button, a')]
      .find(element => element.textContent?.trim().startsWith(label));
    expect(item, label).toBeDefined();
    item!.click();
    await stabilize();
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
    await action(label);
  }

  it('busca, filtra, guarda un anuncio y prepara una consulta sin enviarla', async () => {
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
    await action('Aplicar filtros');
    await stabilize();
    expect(text()).toContain('1 habitación encontrada');
    await action('Ver mapa');
    expect(page().querySelector('.map-open')).toBeTruthy();
    await action('San Carlos');
    expect(page().querySelector('.map-caption')?.textContent).toContain('Cuarto iluminado');
    await action('Ver listado');
    await action('Guardar');
    expect(TestBed.inject(RoomService).isSaved('san-carlos-320')).toBe(true);
    await action('Ver anuncio');
    expect(text()).toContain('Cuarto iluminado con escritorio y baño propio');
    await action('Contactar al propietario');
    await action('Preparar consulta');
    expect(text()).toContain('Revisa los campos');
    await enter('nombre', 'Estudiante Prueba');
    await enter('correo', 'consulta@roomi.test');
    await enter('mensaje', '¿Puedo visitar la habitación el sábado?');
    await action('Preparar consulta');
    await vi.waitFor(async () => {
      await stabilize();
      expect(text()).toContain('Mensaje preparado');
    });
    expect(page().querySelector('textarea')?.value).toContain('consulta@roomi.test');
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
    expect(TestBed.inject(Router).url).toBe('/acceso');
    expect(text()).toContain('Inicia sesión o crea tu cuenta');
    await action('Seguir explorando como invitado');
    expect(TestBed.inject(Router).url).toBe('/explorar');
    await harness.navigateByUrl('/propietario');
    expect(TestBed.inject(Router).url).toBe('/acceso');
    await enter('correo', 'incorrecto');
    await action('Continuar');
    expect(text()).toContain('Revisa tu correo o teléfono');
    await enter('correo', 'propietario@roomi.test');
    await action('Continuar');
    await enter('contrasena', 'incorrecta');
    await action('Iniciar sesión');
    expect(text()).toContain('no coinciden');
    await harness.navigateByUrl('/registro');
    await enter('nombre', 'Cuenta Prueba');
    await enter('correo', 'nueva@roomi.test');
    await enter('contrasena', 'prueba123');
    await action('Crear cuenta');
    expect(text()).toContain('Cuenta de demostración creada');
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

  it('crea, edita y retira un anuncio y refleja ambas decisiones de moderación', async () => {
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
    expect(text()).toContain('Pendiente');
    expect(text()).toContain('Aprobada');
    expect(text()).toContain('Rechazada');
    await action('Publicar habitación');
    await action('Revisar publicación');
    expect(text()).toContain('Escribe el título del anuncio.');
    await enter('titulo', 'Habitación de prueba');
    await enter('direccion', 'Pasaje de prueba 10');
    await enter('precio', '430');
    await enter('garantia', '100');
    await enter('minutos', '13');
    await enter('descripcion', 'Cuarto de prueba con luz natural.');
    await enter('condiciones', 'Coordinar una visita de prueba.');
    await action('Revisar publicación');
    expect(text()).toContain('Revisa tu publicación');
    await action('Enviar a revisión');
    expect(text()).toContain('Publicación enviada a revisión');
    await action('Ver mis anuncios');
    await action('Editar Habitación de prueba');
    await enter('precio', '410');
    await action('Revisar publicación');
    await action('Enviar a revisión');
    await action('Ver mis anuncios');
    expect(text()).toContain('S/ 410 / mes');

    await chooseProfile('Administrador');
    await action('Revisar anuncio Habitación de prueba');
    await action('Rechazar anuncio');
    expect(text()).toContain('Escribe un motivo');
    await enter('motivo', 'Añade referencias para ubicar el alojamiento.');
    await action('Rechazar anuncio');
    expect(text()).toContain('Anuncio rechazado');
    await action('Volver a la cola');
    await action('Revisar anuncio Habitación independiente en Chilca');
    await action('Aprobar anuncio');
    expect(text()).toContain('Anuncio aprobado en la demostración');
    expect(TestBed.inject(RoomService).rooms().find(room => room.id === 'chilca-en-revision')?.status).toBe('approved');

    await chooseProfile('Propietario');
    expect(text()).toContain('Añade referencias para ubicar el alojamiento.');
    const room = [...page().querySelectorAll('article')].find(item => item.textContent?.includes('Habitación independiente en Chilca'));
    expect(room?.textContent).toContain('Aprobada');
    await action('Retirar Habitación de prueba');
    expect(page().querySelector('dialog')?.open).toBe(true);
    expect(text()).toContain('¿Quieres retirar «Habitación de prueba»');
    await action('Cancelar');
    expect(page().querySelector('dialog')?.open).toBe(false);
    await action('Retirar Habitación de prueba');
    await action('Retirar anuncio');
    expect(text()).toContain('Publicación retirada');
    expect([...page().querySelectorAll('article')].some(item => item.textContent?.includes('Habitación de prueba'))).toBe(false);
  });
});

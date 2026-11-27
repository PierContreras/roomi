import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'explorar', renderMode: RenderMode.Client },
  { path: 'buscar', renderMode: RenderMode.Client },
  { path: 'guardados', renderMode: RenderMode.Client },
  { path: 'habitaciones/:id/contacto', renderMode: RenderMode.Client },
  { path: 'habitaciones/:id/compartir', renderMode: RenderMode.Client },
  { path: 'habitaciones/:id', renderMode: RenderMode.Client },
  { path: 'propietario', renderMode: RenderMode.Client },
  { path: 'administracion', renderMode: RenderMode.Client },
  { path: 'propietario/nuevo', renderMode: RenderMode.Client },
  { path: 'propietario/:id/editar', renderMode: RenderMode.Client },
  { path: '', renderMode: RenderMode.Server },
  { path: 'ayuda', renderMode: RenderMode.Server },
  { path: 'acceso', renderMode: RenderMode.Server },
  { path: 'registro', renderMode: RenderMode.Server },
  { path: '**', renderMode: RenderMode.Server, status: 404 },
];

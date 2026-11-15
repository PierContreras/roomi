import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'explorar', renderMode: RenderMode.Client },
  { path: 'buscar', renderMode: RenderMode.Client },
  { path: 'guardados', renderMode: RenderMode.Client },
  { path: 'habitaciones/**', renderMode: RenderMode.Client },
  { path: 'propietario', renderMode: RenderMode.Client },
  { path: 'propietario/**', renderMode: RenderMode.Client },
  { path: 'administracion', renderMode: RenderMode.Client },
  { path: 'administracion/**', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Server },
];

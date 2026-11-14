import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'habitaciones/**', renderMode: RenderMode.Client },
  { path: 'propietario', renderMode: RenderMode.Client },
  { path: 'propietario/**', renderMode: RenderMode.Client },
  { path: 'administracion', renderMode: RenderMode.Client },
  { path: 'administracion/**', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Server },
];

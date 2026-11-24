import { Routes } from '@angular/router';
import { requireRole } from './services/role.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'explorar' },
  { path: 'explorar', loadComponent: () => import('./components/explore/explore-page').then(m => m.ExplorePage), title: 'Explorar | ROOMI' },
  { path: 'buscar', loadComponent: () => import('./components/rooms/search-page').then(m => m.SearchPage), title: 'Buscar | ROOMI' },
  { path: 'habitaciones/:id/contacto', canActivate: [requireRole('contact')], loadComponent: () => import('./components/rooms/room-contact-page').then(m => m.RoomContactPage), title: 'Consulta | ROOMI' },
  { path: 'habitaciones/:id/compartir', loadComponent: () => import('./components/rooms/room-share-page').then(m => m.RoomSharePage), title: 'Compartir anuncio | ROOMI' },
  { path: 'habitaciones/:id', loadComponent: () => import('./components/rooms/room-detail-page').then(m => m.RoomDetailPage), title: 'Habitación | ROOMI' },
  { path: 'guardados', loadComponent: () => import('./components/rooms/saved-page').then(m => m.SavedPage), title: 'Guardados | ROOMI' },
  { path: 'ayuda', loadComponent: () => import('./components/help/help-page').then(m => m.HelpPage), title: 'Centro de ayuda | ROOMI' },
  { path: 'acceso', loadComponent: () => import('./components/access/access-page').then(m => m.AccessPage), title: 'Iniciar sesión | ROOMI' },
  { path: 'registro', loadComponent: () => import('./components/access/access-page').then(m => m.AccessPage), data: { mode: 'register' }, title: 'Registro | ROOMI' },
  { path: 'propietario', canActivate: [requireRole('account')], loadComponent: () => import('./components/owner/owner-page').then(m => m.OwnerPage), title: 'Mis anuncios | ROOMI' },
  { path: 'propietario/nuevo', canActivate: [requireRole('account')], loadComponent: () => import('./components/owner/room-editor-page').then(m => m.RoomEditorPage), title: 'Publicar habitación | ROOMI' },
  { path: 'propietario/:id/editar', canActivate: [requireRole('account')], loadComponent: () => import('./components/owner/room-editor-page').then(m => m.RoomEditorPage), title: 'Editar habitación | ROOMI' },
  { path: 'administracion', canActivate: [requireRole('admin')], loadComponent: () => import('./components/admin/admin-queue-page').then(m => m.AdminQueuePage), title: 'Revisión de anuncios | ROOMI' },
  { path: 'administracion/:id', canActivate: [requireRole('admin')], loadComponent: () => import('./components/admin/admin-review-page').then(m => m.AdminReviewPage), title: 'Revisar anuncio | ROOMI' },
  { path: '**', loadComponent: () => import('./components/shared/not-found-page').then(m => m.NotFoundPage), title: 'Página no encontrada | ROOMI' },
];

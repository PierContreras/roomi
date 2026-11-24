import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from './session.service';

export function requireRole(role: 'account' | 'admin' | 'contact'): CanActivateFn {
  return (route, state) => {
    const session = inject(SessionService);
    const router = inject(Router);
    const user = session.user();
    if (role === 'admin' ? user?.role === 'admin' : session.publicAccount()) return true;
    if (user) return router.createUrlTree([user.role === 'admin' ? '/administracion' : '/explorar']);
    return router.createUrlTree(['/acceso'], {
      queryParams: role === 'contact' ? { retorno: state.url } :
        route.routeConfig?.path === 'propietario/nuevo' ? { destino: 'publicar' } : {},
    });
  };
}

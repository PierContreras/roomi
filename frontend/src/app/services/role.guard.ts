import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from './session.service';

export function requireRole(role: 'account' | 'contact' | 'admin'): CanActivateFn {
  return (route, state) => {
    const session = inject(SessionService);
    const router = inject(Router);
    if (role === 'admin' ? session.administrator() : session.publicAccount()) return true;
    if (session.user()) return router.createUrlTree([session.administrator() ? '/administracion' : '/explorar']);
    return router.createUrlTree(['/acceso'], {
      queryParams: role === 'contact' ? { retorno: state.url } :
        route.routeConfig?.path === 'propietario/nuevo' ? { destino: 'publicar' } : {},
    });
  };
}

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from './session.service';

export function requireRole(role: 'account' | 'contact'): CanActivateFn {
  return (route, state) => {
    const session = inject(SessionService);
    const router = inject(Router);
    if (session.publicAccount()) return true;
    return router.createUrlTree(['/acceso'], {
      queryParams: role === 'contact' ? { retorno: state.url } :
        route.routeConfig?.path === 'propietario/nuevo' ? { destino: 'publicar' } : {},
    });
  };
}

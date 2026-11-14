import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Role } from '../interfaces/user';
import { SessionService } from './session.service';

export function requireRole(role: Role): CanActivateFn {
  return route => {
    if (inject(SessionService).user()?.role === role) return true;
    return inject(Router).createUrlTree(['/acceso'], {
      queryParams: route.routeConfig?.path === 'propietario/nuevo' ? { destino: 'publicar' } : {},
    });
  };
}

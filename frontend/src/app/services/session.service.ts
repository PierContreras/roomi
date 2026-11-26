import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DOCUMENT, DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { User } from '../interfaces/user';

interface Session { token: string; user: User }
const sessionKey = 'roomi.session.v1';

function expiresAt(token: string): number {
  try {
    const segments = token.split('.');
    if (segments.length !== 3 || !segments.every(Boolean)) return 0;
    const { exp } = JSON.parse(atob(segments[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : 0;
  } catch {
    return 0;
  }
}

export function apiError(error: unknown, fallback: string) {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  switch (error.status) {
    case 0: return 'No pudimos conectar con ROOMI. Revisa tu conexión e inténtalo de nuevo.';
    case 401: return 'Tu sesión ya no está activa. Vuelve a iniciar sesión e inténtalo de nuevo.';
    case 403: return 'Tu cuenta no tiene permiso para esta acción. Verifica que estés usando la cuenta correcta.';
    case 404: return 'El anuncio ya no está disponible. Vuelve al listado para comprobarlo.';
    case 409: return 'La acción ya se registró o el anuncio cambió. Actualiza la página antes de volver a intentarlo.';
    case 422: return 'Revisa los datos del formulario y corrige los campos marcados antes de volver a enviarlo.';
    default: return fallback;
  }
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly http = inject(HttpClient);
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly current = signal<Session | null>(null);
  private expiryTimer?: number;
  readonly user = computed(() => this.current()?.user ?? null);
  readonly publicAccount = computed(() => !!this.user());

  constructor() {
    // Las guardas necesitan el estado antes de la navegación inicial.
    try {
      const stored = this.window?.sessionStorage.getItem(sessionKey);
      if (stored) {
        const session: Session = JSON.parse(stored);
        if (typeof session?.token === 'string' && expiresAt(session.token) > Date.now() &&
            typeof session.user?.id === 'string' && typeof session.user.name === 'string' &&
            typeof session.user.email === 'string' && ['student', 'owner'].includes(session.user.role)) {
          this.setSession(session);
        } else {
          this.signOut();
        }
      }
    } catch {
      this.signOut();
    }
    inject(DestroyRef).onDestroy(() => this.window?.clearTimeout(this.expiryTimer));
  }

  headers(): Record<string, string> {
    const token = this.current()?.token;
    return token ? { Authorization: 'Bearer ' + token } : {};
  }

  async signIn(email: string, password: string) {
    return this.start('login', { email, password });
  }

  async register(name: string, email: string, password: string) {
    return this.start('registro', { name, email, password });
  }

  signOut() {
    this.current.set(null);
    this.window?.clearTimeout(this.expiryTimer);
    try {
      this.window?.sessionStorage.removeItem(sessionKey);
    } catch {
      // El navegador puede bloquear el almacenamiento.
    }
  }

  private async start(path: string, body: object) {
    const session = await firstValueFrom(
      this.http.post<Session>(`${environment.apiUrl}/auth/${path}`, body),
    );
    this.setSession(session);
    return session.user;
  }

  private setSession(session: Session) {
    this.current.set(session);
    this.window?.clearTimeout(this.expiryTimer);
    const remaining = expiresAt(session.token) - Date.now();
    if (!this.window || remaining <= 0) return;
    this.expiryTimer = this.window.setTimeout(() => this.signOut(), remaining);
    try {
      this.window.sessionStorage.setItem(sessionKey, JSON.stringify(session));
    } catch {
      // El acceso sigue funcionando en memoria si el almacenamiento está bloqueado.
    }
  }
}

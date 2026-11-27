import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { DOCUMENT, DestroyRef, Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
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

function readSession(stored: string | null): Session | null {
  try {
    const session: { token: string; user: Omit<User, 'role'> & { role: string } } | null =
      JSON.parse(stored ?? 'null');
    if (typeof session?.token === 'string' && expiresAt(session.token) > Date.now() &&
        typeof session.user?.id === 'string' && typeof session.user.name === 'string' &&
        typeof session.user.email === 'string' && ['user', 'admin', 'student', 'owner'].includes(session.user.role)) {
      return { token: session.token, user: { ...session.user, role: session.user.role === 'admin' ? 'admin' : 'user' } };
    }
  } catch {
    // Una entrada dañada equivale a una sesión ausente.
  }
  return null;
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
  private readonly document = inject(DOCUMENT);
  private readonly window = isPlatformBrowser(inject(PLATFORM_ID)) ? this.document.defaultView : null;
  private readonly current = signal<Session | null>(null);
  private expiryTimer?: number;
  readonly user = computed(() => this.current()?.user ?? null);
  readonly administrator = computed(() => this.user()?.role === 'admin');
  readonly publicAccount = computed(() => this.user()?.role === 'user');

  constructor() {
    const browser = this.window;
    if (!browser) return;
    const persistent = readSession(this.readStorage('localStorage'));
    const tabSession = readSession(this.readStorage('sessionStorage'));
    this.setSession(persistent ?? tabSession);
    if (!persistent && tabSession) this.persist(tabSession);
    else this.removeStorage('sessionStorage');
    if (!persistent && !tabSession) this.removeStorage('localStorage');

    const sync = (event: StorageEvent) => {
      if (event.key === sessionKey || event.key === null) {
        this.setSession(readSession(this.readStorage('localStorage')));
      }
    };
    browser.addEventListener('storage', sync);
    inject(DestroyRef).onDestroy(() => {
      browser.removeEventListener('storage', sync);
      browser.clearTimeout(this.expiryTimer);
    });
  }

  private readStorage(storage: 'localStorage' | 'sessionStorage') {
    try {
      return this.window?.[storage].getItem(sessionKey) ?? null;
    } catch {
      return null;
    }
  }

  private removeStorage(storage: 'localStorage' | 'sessionStorage') {
    try {
      this.window?.[storage].removeItem(sessionKey);
    } catch {
      // El navegador puede bloquear el almacenamiento.
    }
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
    this.setSession(null);
    this.removeStorage('localStorage');
    this.removeStorage('sessionStorage');
  }

  private async start(path: string, body: object) {
    const session = await firstValueFrom(
      this.http.post<Session>(`${environment.apiUrl}/auth/${path}`, body),
    );
    this.setSession(session);
    this.persist(session);
    return session.user;
  }

  private setSession(session: Session | null) {
    this.current.set(session);
    this.window?.clearTimeout(this.expiryTimer);
    if (!session) return;
    const remaining = expiresAt(session.token) - Date.now();
    if (!this.window || remaining <= 0) return;
    this.expiryTimer = this.window.setTimeout(() => this.signOut(), remaining);
  }

  private persist(session: Session) {
    const serialized = JSON.stringify(session);
    try {
      this.window?.localStorage.setItem(sessionKey, serialized);
      this.removeStorage('sessionStorage');
    } catch {
      try {
        this.window?.sessionStorage.setItem(sessionKey, serialized);
      } catch {
        // El acceso sigue funcionando en memoria si el almacenamiento está bloqueado.
      }
    }
  }
}

import { HttpClient } from '@angular/common/http';
import { Injectable, Signal, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { SessionService } from './session.service';

interface AdminSummary {
  usuarios: number;
  anunciosPublicados: number;
  reportesPendientes: number;
}

export type AdminSection = 'usuarios' | 'anuncios' | 'reportes' | 'resenas' | 'consultas' | 'moderacion';
export type AdminRecord = { id: string } & Record<string, string | number | null | undefined>;

interface AdminQuery {
  section: AdminSection;
  search: string;
  page: number;
}

interface AdminList {
  registros: AdminRecord[];
  haySiguiente: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);

  summary() {
    return rxResource({
      params: () => this.session.administrator() ? this.session.headers() : undefined,
      stream: ({ params: headers }) => this.http.get<AdminSummary>(
        `${environment.apiUrl}/administracion/resumen`, { headers },
      ),
    });
  }

  list(query: Signal<AdminQuery>) {
    return rxResource({
      params: () => this.session.administrator() ? { ...query(), headers: this.session.headers() } : undefined,
      stream: ({ params: { section, search, page, headers } }) => this.http.get<AdminList>(
        `${environment.apiUrl}/administracion/${section}`, {
          headers, params: { buscar: search, pagina: page },
        },
      ),
    });
  }

  deleteListing(id: string, reason: string) {
    return firstValueFrom(this.http.post<void>(
      `${environment.apiUrl}/administracion/anuncios/${encodeURIComponent(id)}/eliminar`,
      { motivo: reason },
      { headers: this.session.headers() },
    ));
  }
}

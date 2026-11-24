import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable, Signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { catchError, firstValueFrom, of, throwError } from 'rxjs';
import { browserState } from './browser-state';
import { SessionService } from './session.service';
import { ListingResult, PublicRoom, Room, RoomDraft, RoomFilters } from '../interfaces/room';

const api = '/api';
const catalogUrl = `${api}/alojamientos`;

interface Report { id: string; roomId: string; title: string; message: string }
interface Inquiry extends Report { name: string; whatsapp: string | null; email: string | null }
interface Review { id: string; name: string; rating: number; message: string }
interface Created { id: string }

@Injectable({ providedIn: 'root' })
export class RoomService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  private readonly savedState = browserState<readonly string[]>('roomi.saved.v1', []);

  published() {
    return rxResource({ stream: () => this.http.get<PublicRoom[]>(catalogUrl) });
  }

  detail(id: Signal<string>) {
    return rxResource({
      params: id,
      stream: ({ params }) => this.getDetail(params).pipe(
        catchError((error: HttpErrorResponse) => error.status === 404 ? of(null) : throwError(() => error)),
      ),
    });
  }

  search(filters: RoomFilters) {
    let params = new HttpParams();
    if (filters.zone) params = params.set('zona', filters.zone);
    if (filters.university) params = params.set('universidad', filters.university);
    if (filters.type) params = params.set('tipo', filters.type);
    if (filters.maxPrice !== null) params = params.set('precio', filters.maxPrice);
    if (filters.maxMinutes !== null) params = params.set('minutos', filters.maxMinutes);
    if (filters.maxDistance !== null) params = params.set('distancia', filters.maxDistance);
    for (const amenity of filters.amenities) params = params.append('servicio', amenity);
    return firstValueFrom(this.http.get<PublicRoom[]>(catalogUrl, { params }));
  }

  isSaved(id: string) {
    return this.savedState.value().includes(id);
  }

  toggleSaved(id: string) {
    const ids = this.savedState.value();
    this.savedState.set(this.isSaved(id) ? ids.filter(saved => saved !== id) : [...ids, id]);
  }

  managed(role: 'propietario' | 'administracion') {
    return rxResource({ stream: () => this.http.get<Room[]>(`${api}/${role}/alojamientos`, this.auth()) });
  }

  inquiries() {
    return rxResource({ stream: () => this.http.get<Inquiry[]>(`${api}/propietario/consultas`, this.auth()) });
  }

  reports() {
    return rxResource({ stream: () => this.http.get<Report[]>(`${api}/administracion/reportes`, this.auth()) });
  }

  reviews(id: Signal<string>) {
    return rxResource({ params: id, stream: ({ params }) =>
      this.http.get<Review[]>(`${catalogUrl}/${encodeURIComponent(params)}/resenas`),
    });
  }

  save(draft: RoomDraft, id?: string, borrador = false) {
    const { title, zone, university, type, price, deposit, minutes, amenities,
      description, rules, address, photos, latitude, longitude, distanceKm, whatsapp } = draft;
    const body = { title, zone, university, type, price, deposit, minutes,
      amenities, description, rules, address, photos, latitude, longitude, distanceKm, whatsapp: whatsapp || null, borrador };
    return firstValueFrom(id
      ? this.http.put<ListingResult>(`${catalogUrl}/${encodeURIComponent(id)}`, body, this.auth())
      : this.http.post<ListingResult>(catalogUrl, body, this.auth()));
  }

  submitListing(id: string, action: 'enviar' | 'reactivar') {
    return firstValueFrom(this.http.post<ListingResult>(`${catalogUrl}/${encodeURIComponent(id)}/${action}`,
      null, this.auth()));
  }

  suspend(ownerId: string, note: string, lift = false) {
    const action = lift ? 'levantar-suspension' : 'suspender';
    return firstValueFrom(this.http.post<void>(
      `${api}/administracion/propietarios/${encodeURIComponent(ownerId)}/${action}`,
      { note }, this.auth(),
    ));
  }

  withdraw(id: string) {
    return firstValueFrom(this.http.patch<void>(`${catalogUrl}/${encodeURIComponent(id)}/estado`,
      { status: 'retirado' }, this.auth()));
  }

  delete(id: string) {
    return firstValueFrom(this.http.delete<void>(`${catalogUrl}/${encodeURIComponent(id)}`, this.auth()));
  }

  review(id: string, status: 'publicado' | 'rechazado', note: string, revision: number) {
    return firstValueFrom(this.http.patch<void>(`${api}/administracion/alojamientos/${encodeURIComponent(id)}`,
      { status, note, revision }, this.auth()));
  }

  sendContact(id: string, inquiry: { name: string; whatsapp: string; email: string | null; message: string; consent: boolean }) {
    return firstValueFrom(this.http.post<Created>(`${catalogUrl}/${encodeURIComponent(id)}/consultas`, inquiry, this.auth()));
  }

  contact(id: Signal<string>) {
    return rxResource({ params: id, stream: ({ params }) => this.http.get<{ whatsapp: string | null; formulario: boolean }>(
      `${catalogUrl}/${encodeURIComponent(params)}/contacto`, this.auth(),
    ) });
  }

  submitFeedback(id: string, type: 'resenas' | 'reportes', body: { message: string; rating?: number }) {
    return firstValueFrom(this.http.post<Created>(`${catalogUrl}/${encodeURIComponent(id)}/${type}`, body, this.auth()));
  }

  private auth() {
    return { headers: this.session.headers() };
  }

  private getDetail(id: string) {
    return this.http.get<PublicRoom>(`${catalogUrl}/${encodeURIComponent(id)}`);
  }
}

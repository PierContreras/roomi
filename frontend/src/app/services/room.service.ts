import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable, Signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { catchError, firstValueFrom, of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { browserState } from './browser-state';
import { apiError, SessionService } from './session.service';
import { ListingResult, PublicRoom, Room, RoomDraft, RoomFilters } from '../interfaces/room';

const api = environment.apiUrl;
const catalogUrl = `${api}/alojamientos`;

interface Review { id: string; name: string; rating: number; message: string }
interface Created { id: string }

export function publicationError(error: unknown, fallback: string) {
  if (error instanceof HttpErrorResponse && error.status === 422 &&
      typeof error.error?.detail === 'string') {
    return error.error.detail;
  }
  return apiError(error, fallback);
}

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

  managed() {
    return rxResource({ stream: () => this.http.get<Room[]>(`${api}/propietario/alojamientos`, this.auth()) });
  }

  setAvailability(id: string, ocupado: boolean) {
    return firstValueFrom(this.http.patch<void>(
      `${api}/propietario/alojamientos/${encodeURIComponent(id)}/disponibilidad`, { ocupado }, this.auth(),
    ));
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

  withdraw(id: string) {
    return firstValueFrom(this.http.patch<void>(`${catalogUrl}/${encodeURIComponent(id)}/estado`,
      { status: 'retirado' }, this.auth()));
  }

  delete(id: string) {
    return firstValueFrom(this.http.delete<void>(`${catalogUrl}/${encodeURIComponent(id)}`, this.auth()));
  }

  contact(id: Signal<string | undefined>) {
    return rxResource({ params: id, stream: ({ params }) => this.http.get<{ whatsapp: string | null }>(
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

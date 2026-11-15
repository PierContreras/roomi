import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable, Signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { catchError, firstValueFrom, of, throwError } from 'rxjs';
import { browserState } from './browser-state';
import { demoRooms } from './demo-rooms';
import { DemoUser } from '../interfaces/user';
import { PublicRoom, Room, RoomDraft, RoomFilters } from '../interfaces/room';

const catalogUrl = '/api/alojamientos';

@Injectable({ providedIn: 'root' })
export class RoomService {
  private readonly http = inject(HttpClient);
  private readonly catalog = browserState<readonly Room[]>('roomi.rooms.v1', demoRooms);
  private readonly savedState = browserState<readonly string[]>('roomi.saved.v1', []);
  readonly rooms = this.catalog.value;
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

  save(draft: RoomDraft, user: DemoUser, id?: string) {
    const existing = id && this.findOwned(id, user.id);
    if (user.role !== 'owner' || (id && !existing)) return null;
    const room: Room = {
      ...draft, id: id ?? crypto.randomUUID(), ownerId: user.id,
      owner: user.name, status: 'pending',
    };
    this.catalog.set(existing
      ? this.rooms().map(current => current.id === id ? room : current)
      : [room, ...this.rooms()]);
    return room;
  }

  withdraw(id: string, ownerId: string) {
    const room = this.findOwned(id, ownerId);
    if (!room) return false;
    this.catalog.set(this.rooms().map(current => current.id === id ? { ...room, status: 'withdrawn' } : current));
    return true;
  }

  review(id: string, admin: DemoUser, decision: 'approved' | 'rejected', note: string) {
    const room = this.rooms().find(current => current.id === id && current.status === 'pending');
    const reason = note.trim();
    if (admin.role !== 'admin' || !room || (decision === 'rejected' && !reason)) return false;
    const reviewed: Room = { ...room, status: decision, reviewNote: decision === 'rejected' ? reason : undefined };
    this.catalog.set(this.rooms().map(current => current.id === id ? reviewed : current));
    return true;
  }

  findOwned(id: string, ownerId: string) {
    return this.rooms().find(room => room.id === id && room.ownerId === ownerId && room.status !== 'withdrawn');
  }

  async prepareContact(roomId: string, inquiry: { name: string; email: string; message: string }) {
    await firstValueFrom(this.getDetail(roomId));
    return 'Hola, soy ' + inquiry.name.trim() + '. ' + inquiry.message.trim() + '\nCorreo de contacto: ' + inquiry.email.trim();
  }

  private getDetail(id: string) {
    return this.http.get<PublicRoom>(`${catalogUrl}/${encodeURIComponent(id)}`);
  }
}

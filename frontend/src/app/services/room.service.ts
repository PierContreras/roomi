import { computed, Injectable } from '@angular/core';
import { browserState } from './browser-state';
import { demoRooms } from './demo-rooms';
import { DemoUser } from '../interfaces/user';
import { Room, RoomDraft, RoomFilters } from '../interfaces/room';

@Injectable({ providedIn: 'root' })
export class RoomService {
  private readonly catalog = browserState<readonly Room[]>('roomi.rooms.v1', demoRooms);
  private readonly savedState = browserState<readonly string[]>('roomi.saved.v1', []);
  readonly rooms = this.catalog.value;
  readonly published = computed(() => this.rooms().filter(room => room.status === 'approved'));
  readonly saved = computed(() => this.published().filter(room => this.savedState.value().includes(room.id)));

  findPublished(id: string) {
    return this.published().find(room => room.id === id);
  }

  async search(filters: RoomFilters) {
    await new Promise<void>(resolve => setTimeout(resolve, 180));
    return this.published().filter(room =>
      (!filters.zone || room.zone === filters.zone) &&
      (!filters.university || room.university === filters.university) &&
      (!filters.type || room.type === filters.type) &&
      (filters.maxPrice === null || room.price <= filters.maxPrice) &&
      (filters.maxMinutes === null || room.minutes <= filters.maxMinutes) &&
      filters.amenities.every(amenity => room.amenities.includes(amenity)),
    );
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
    if (!this.findPublished(roomId)) throw new Error('Este anuncio ya no está disponible.');
    return 'Hola, soy ' + inquiry.name.trim() + '. ' + inquiry.message.trim() + '\nCorreo de contacto: ' + inquiry.email.trim();
  }
}

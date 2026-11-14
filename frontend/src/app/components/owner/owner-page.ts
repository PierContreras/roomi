import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionService } from '../../services/session.service';
import { Room } from '../../interfaces/room';
import { RoomService } from '../../services/room.service';
import { ConfirmDialog } from '../shared/confirm-dialog';
import { StatusBadge } from '../shared/status-badge';

@Component({
  imports: [RouterLink, StatusBadge, ConfirmDialog],
  templateUrl: './owner-page.html',
})
export class OwnerPage {
  private readonly session = inject(SessionService);
  private readonly catalog = inject(RoomService);
  protected readonly listings = computed(() => this.catalog.rooms().filter(room =>
    room.ownerId === this.session.user()?.id && room.status !== 'withdrawn',
  ));
  protected readonly selected = signal<Room | null>(null);
  protected readonly notice = signal('');

  protected withdraw() {
    const current = this.selected();
    const user = this.session.user();
    if (!current || !user) return;
    const withdrawn = this.catalog.withdraw(current.id, user.id);
    this.notice.set(withdrawn ? 'Publicación retirada.' : 'El anuncio ya no está disponible.');
  }
}

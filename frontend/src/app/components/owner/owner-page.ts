import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionService } from '../../services/session.service';
import { Room } from '../../interfaces/room';
import { RoomService } from '../../services/room.service';
import { ConfirmDialog } from '../shared/confirm-dialog';
import { StatusBadge } from '../shared/status-badge';
import { UiLibraries } from '../../services/ui-libraries';
import { UiIcon } from '../shared/ui-icon';

@Component({
  imports: [RouterLink, StatusBadge, ConfirmDialog, UiIcon],
  templateUrl: './owner-page.html',
})
export class OwnerPage {
  private readonly session = inject(SessionService);
  private readonly catalog = inject(RoomService);
  private readonly libraries = inject(UiLibraries);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly listings = computed(() => this.catalog.rooms().filter(room =>
    room.ownerId === this.session.user()?.id && room.status !== 'withdrawn',
  ));
  protected readonly selected = signal<Room | null>(null);
  protected readonly notice = signal('');
  protected readonly confirming = signal(false);

  protected async confirmWithdrawal(room: Room, fallback: ConfirmDialog) {
    if (this.confirming()) return;
    this.selected.set(room);
    this.confirming.set(true);
    try {
      const accepted = await this.libraries.confirm('Retirar publicación',
        `¿Quieres retirar «${room.title}» del directorio?`, 'Retirar anuncio');
      if (this.destroyRef.destroyed) return;
      if (accepted === undefined) {
        fallback.open();
        return;
      }
      if (accepted) this.withdraw();
      this.selected.set(null);
    } finally {
      this.confirming.set(false);
    }
  }

  protected withdraw() {
    const current = this.selected();
    const user = this.session.user();
    if (!current || !user) return;
    const withdrawn = this.catalog.withdraw(current.id, user.id);
    this.notice.set(withdrawn ? 'Publicación retirada.' : 'El anuncio ya no está disponible.');
    if (withdrawn) void this.libraries.success('Publicación retirada');
  }
}

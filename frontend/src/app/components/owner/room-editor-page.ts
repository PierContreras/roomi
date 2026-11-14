import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionService } from '../../services/session.service';
import { Room, RoomDraft } from '../../interfaces/room';
import { RoomGallery } from '../rooms/room-gallery';
import { RoomService } from '../../services/room.service';
import { StatusBadge } from '../shared/status-badge';
import { RoomForm } from './room-form';

@Component({
  imports: [RouterLink, RoomForm, RoomGallery, StatusBadge],
  templateUrl: './room-editor-page.html',
})
export class RoomEditorPage {
  readonly id = input<string>();
  private readonly catalog = inject(RoomService);
  private readonly session = inject(SessionService);
  protected readonly existing = computed(() => {
    const id = this.id();
    const user = this.session.user();
    return id && user ? this.catalog.findOwned(id, user.id) : undefined;
  });
  protected readonly draft = signal<RoomDraft | undefined>(undefined);
  protected readonly preview = signal(false);
  protected readonly saved = signal<Room | null>(null);
  protected readonly error = signal('');

  protected review(draft: RoomDraft) {
    this.draft.set(draft);
    this.preview.set(true);
  }

  protected publish(draft: RoomDraft) {
    const user = this.session.user();
    if (!user) return;
    const result = this.catalog.save(draft, user, this.id());
    if (result) this.saved.set(result);
    else this.error.set('El anuncio ya no está disponible para edición.');
  }
}

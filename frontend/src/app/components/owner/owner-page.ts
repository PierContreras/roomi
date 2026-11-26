import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiError } from '../../services/session.service';
import { Room } from '../../interfaces/room';
import { publicationError, RoomService } from '../../services/room.service';
import { ConfirmDialog } from '../shared/confirm-dialog';
import { StatusBadge } from '../shared/status-badge';
import { UiLibraries } from '../../services/ui-libraries';
import { UiIcon } from '../shared/ui-icon';
import { RevealOnScroll } from '../shared/reveal-on-scroll';

const listingActions = {
  withdraw: {
    heading: 'Retirar publicación',
    approve: 'Retirar anuncio',
    message: (title: string) => `¿Quieres retirar «${title}» del directorio?`,
    success: 'Publicación retirada.',
    error: 'No pudimos retirar la publicación.',
  },
  delete: {
    heading: 'Eliminar publicación',
    approve: 'Eliminar anuncio',
    message: (title: string) => `¿Quieres eliminar «${title}» de Mis anuncios? Su historial se conservará.`,
    success: 'Publicación eliminada.',
    error: 'No pudimos eliminar la publicación.',
  },
};

type ListingAction = keyof typeof listingActions;

@Component({
  imports: [RouterLink, StatusBadge, ConfirmDialog, UiIcon, RevealOnScroll],
  templateUrl: './owner-page.html',
  styleUrl: './owner-page.css',
})
export class OwnerPage {
  private readonly catalog = inject(RoomService);
  private readonly libraries = inject(UiLibraries);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly managed = this.catalog.managed();
  protected readonly listings = computed(() => this.managed.hasValue() ? this.managed.value() : []);
  protected readonly publishedCount = computed(() => this.listings().filter(room => room.status === 'publicado' && !room.ocupado).length);
  protected readonly draftCount = computed(() => this.listings().filter(room => room.status === 'borrador').length);
  protected readonly updating = signal(false);
  protected readonly error = signal('');
  protected readonly selected = signal<{ room: Room; action: ListingAction } | null>(null);
  protected readonly confirmationText = computed(() => {
    const selection = this.selected();
    if (!selection) return null;
    const text = listingActions[selection.action];
    return { ...text, prompt: text.message(selection.room.title) };
  });
  protected readonly notice = signal('');
  protected readonly confirming = signal(false);

  protected async confirmAction(room: Room, action: ListingAction, fallback: ConfirmDialog) {
    if (this.confirming() || this.updating()) return;
    this.selected.set({ room, action });
    this.confirming.set(true);
    try {
      const text = listingActions[action];
      const accepted = await this.libraries.confirm(text.heading, text.message(room.title), text.approve, action === 'delete');
      if (this.destroyRef.destroyed) return;
      if (accepted === undefined) {
        fallback.open();
        return;
      }
      if (accepted) await this.updateListing();
      this.selected.set(null);
    } finally {
      this.confirming.set(false);
    }
  }

  protected async setAvailability(room: Room) {
    const ocupado = !room.ocupado;
    await this.updateStatus(
      () => this.catalog.setAvailability(room.id, ocupado),
      () => this.managed.reload(),
      ocupado ? 'Habitación marcada como ocupada.' : 'Habitación disponible en el catálogo.',
      'No pudimos actualizar la disponibilidad.',
    );
  }

  private async updateStatus(
    save: () => Promise<void>, reload: () => unknown, success: string, failure: string,
  ) {
    if (this.updating()) return;
    this.updating.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      await save();
      reload();
      this.notice.set(success);
    } catch (error) {
      this.error.set(apiError(error, failure));
    } finally {
      this.updating.set(false);
    }
  }

  protected async submit(room: Room, action: 'enviar' | 'reactivar') {
    if (this.updating()) return;
    this.updating.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      await this.catalog.submitListing(room.id, action);
      this.notice.set('Anuncio publicado.');
      this.managed.reload();
    } catch (error) {
      this.error.set(publicationError(error, 'No pudimos publicar el anuncio.'));
    } finally {
      this.updating.set(false);
    }
  }

  protected async updateListing() {
    const current = this.selected();
    if (!current || this.updating()) return;
    const text = listingActions[current.action];
    this.error.set('');
    this.notice.set('');
    this.updating.set(true);
    try {
      await this.catalog[current.action](current.room.id);
      this.notice.set(text.success);
      this.managed.reload();
    } catch (error) {
      this.error.set(apiError(error, text.error));
    } finally {
      this.updating.set(false);
    }
  }
}

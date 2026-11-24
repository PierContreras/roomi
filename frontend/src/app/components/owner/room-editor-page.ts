import { Component, computed, inject, input, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { apiError } from '../../services/session.service';
import { RoomDraft } from '../../interfaces/room';
import { RoomGallery } from '../rooms/room-gallery';
import { RoomService } from '../../services/room.service';
import { StatusBadge } from '../shared/status-badge';
import { RoomForm } from './room-form';
import { UiLibraries } from '../../services/ui-libraries';

const unavailableListing = 'No encontramos este anuncio en tu cuenta.';

@Component({
  imports: [RouterLink, RoomForm, RoomGallery, StatusBadge],
  templateUrl: './room-editor-page.html',
})
export class RoomEditorPage {
  readonly id = input<string>();
  private readonly catalog = inject(RoomService);
  protected readonly managed = this.catalog.managed('propietario');
  protected readonly unavailableListing = unavailableListing;
  protected readonly loadError = computed(() =>
    this.editError(this.managed.error(), 'No pudimos cargar el anuncio. Intenta de nuevo o vuelve a Mis anuncios.'));
  private readonly libraries = inject(UiLibraries);
  protected readonly existing = computed(() => {
    const id = this.id();
    return id && this.managed.hasValue()
      ? this.managed.value().find(room => room.id === id)
      : undefined;
  });
  protected readonly draft = signal<RoomDraft | undefined>(undefined);
  protected readonly preview = signal(false);
  protected readonly saved = signal<RoomDraft | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected review(draft: RoomDraft) {
    this.draft.set(draft);
    this.preview.set(true);
  }

  protected async publish(draft: RoomDraft) {
    if (this.busy()) return;
    this.error.set('');
    this.busy.set(true);
    try {
      await this.catalog.save(draft, this.id());
      this.saved.set(draft);
      void this.libraries.success('Publicación enviada a revisión');
    } catch (error) {
      this.error.set(this.editError(error, 'No pudimos guardar. Revisa los datos y vuelve a intentar.'));
    } finally {
      this.busy.set(false);
    }
  }

  private editError(error: unknown, fallback: string) {
    if (this.id() && error instanceof HttpErrorResponse && error.status === 404) return unavailableListing;
    return apiError(error, fallback);
  }
}

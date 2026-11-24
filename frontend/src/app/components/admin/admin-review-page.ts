import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { apiError } from '../../services/session.service';
import { RoomGallery } from '../rooms/room-gallery';
import { RoomService } from '../../services/room.service';
import { StatusBadge } from '../shared/status-badge';

@Component({
  imports: [RouterLink, FormsModule, RoomGallery, StatusBadge],
  templateUrl: './admin-review-page.html',
})
export class AdminReviewPage {
  readonly id = input.required<string>();
  private readonly catalog = inject(RoomService);
  protected readonly managed = this.catalog.managed('administracion');
  protected readonly room = computed(() => this.managed.hasValue()
    ? this.managed.value().find(room => room.id === this.id()) : undefined);
  protected readonly busy = signal(false);
  protected readonly notice = signal('');
  protected readonly error = signal('');
  protected reason = '';

  protected async review(decision: 'approved' | 'rejected') {
    const revision = this.room()?.revision;
    if (this.busy() || revision === undefined) return;
    this.error.set('');
    if (decision === 'rejected' && !this.reason.trim()) {
      this.error.set('Escribe un motivo para que el propietario sepa qué debe corregir.');
      return;
    }
    this.busy.set(true);
    try {
      await this.catalog.review(this.id(), decision, decision === 'rejected' ? this.reason : '', revision);
      this.notice.set(decision === 'approved' ? 'Anuncio aprobado.' : 'Anuncio rechazado. El propietario puede ver el motivo.');
      this.managed.reload();
    } catch (error) {
      this.error.set(apiError(error, 'No pudimos registrar la decisión.'));
    } finally {
      this.busy.set(false);
    }
  }
}

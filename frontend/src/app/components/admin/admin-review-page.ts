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

  protected async suspend(ownerId: string, lift = false) {
    if (this.busy()) return;
    this.error.set('');
    if (!this.reason.trim()) {
      this.error.set('Escribe el motivo de la suspensión o de su levantamiento.');
      return;
    }
    this.busy.set(true);
    try {
      await this.catalog.suspend(ownerId, this.reason, lift);
      this.notice.set(lift ? 'Suspensión levantada.' : 'Propietario suspendido.');
    } catch (error) {
      this.error.set(apiError(error, 'No pudimos actualizar la suspensión.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async review(decision: 'publicado' | 'rechazado') {
    const revision = this.room()?.revision;
    if (this.busy() || revision === undefined) return;
    this.error.set('');
    if (!this.reason.trim()) {
      this.error.set('Escribe el motivo de la decisión.');
      return;
    }
    this.busy.set(true);
    try {
      await this.catalog.review(this.id(), decision, this.reason, revision);
      this.notice.set(decision === 'publicado' ? 'Anuncio aprobado.' : 'Anuncio rechazado. El propietario puede ver el motivo.');
      this.managed.reload();
    } catch (error) {
      this.error.set(apiError(error, 'No pudimos registrar la decisión.'));
    } finally {
      this.busy.set(false);
    }
  }
}

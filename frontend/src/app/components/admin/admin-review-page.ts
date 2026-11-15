import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SessionService } from '../../services/session.service';
import { RoomGallery } from '../rooms/room-gallery';
import { RoomService } from '../../services/room.service';
import { StatusBadge } from '../shared/status-badge';

@Component({
  imports: [RouterLink, FormsModule, RoomGallery, StatusBadge],
  templateUrl: './admin-review-page.html',
})
export class AdminReviewPage {
  readonly id = input.required<string>();
  private readonly session = inject(SessionService);
  private readonly catalog = inject(RoomService);
  protected readonly room = computed(() => this.catalog.rooms().find(room =>
    room.id === this.id() && room.status !== 'withdrawn',
  ));
  protected readonly notice = signal('');
  protected readonly error = signal('');
  protected reason = '';

  protected review(decision: 'approved' | 'rejected') {
    this.error.set('');
    if (decision === 'rejected' && !this.reason.trim()) {
      this.error.set('Escribe un motivo para que el propietario sepa qué debe corregir.');
      return;
    }
    const admin = this.session.user();
    if (!admin || !this.catalog.review(this.id(), admin, decision, this.reason)) {
      this.error.set('El anuncio ya no está pendiente de revisión.');
      return;
    }
    this.notice.set(decision === 'approved' ? 'Anuncio aprobado en la demostración.' : 'Anuncio rechazado. El propietario puede ver el motivo.');
  }
}

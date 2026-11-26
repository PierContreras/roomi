import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { apiError, SessionService } from '../../services/session.service';
import { RouterLink } from '@angular/router';
import { RoomGallery } from './room-gallery';
import { RoomMap } from './room-map';
import { RoomService } from '../../services/room.service';
import { roomNavigation } from './room-navigation';
import { roomPhotos } from './room-photos';
import { whatsappUrl } from './room-contact';
import { amenityIcons, UiIcon } from '../shared/ui-icon';
import { RevealOnScroll } from '../shared/reveal-on-scroll';

@Component({
  imports: [RouterLink, FormsModule, RoomGallery, RoomMap, UiIcon, RevealOnScroll],
  templateUrl: './room-detail-page.html',
  styleUrl: './room-detail-page.css',
})
export class RoomDetailPage {
  readonly id = input.required<string>();
  protected readonly navigation = roomNavigation();
  protected readonly catalog = inject(RoomService);
  protected readonly room = this.catalog.detail(this.id);
  protected readonly amenityIcons = amenityIcons;
  protected readonly reviews = this.catalog.reviews(this.id);
  protected readonly session = inject(SessionService);
  protected readonly contact = this.catalog.contact(computed(() =>
    this.session.user() && this.room.hasValue() && this.room.value()?.contactAvailable ? this.id() : undefined));
  protected readonly whatsappUrl = whatsappUrl;
  protected readonly feedback = signal<'resenas' | 'reportes' | null>(null);
  protected readonly busy = signal(false);
  protected readonly notice = signal('');
  protected readonly error = signal('');
  protected readonly errorKind = signal<'rating' | 'message' | null>(null);
  protected message = '';
  protected readonly stars = [1, 2, 3, 4, 5];
  protected readonly reviewSummary = computed(() => {
    const entries = this.reviews.hasValue() ? this.reviews.value() : [];
    if (!entries.length) return null;
    const counts = [0, 0, 0, 0, 0];
    let total = 0;
    for (const review of entries) {
      counts[review.rating - 1]++;
      total += review.rating;
    }
    return {
      average: new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 }).format(total / entries.length),
      count: entries.length,
      distribution: counts.map((count, index) => ({
        stars: index + 1, count, percent: count * 100 / entries.length,
      })).reverse(),
    };
  });
  protected readonly photos = computed(() => {
    const room = this.room.value();
    return room ? roomPhotos(room) : [];
  });
  protected rating: number | null = null;

  constructor() {
    effect(() => {
      this.id();
      this.feedback.set(null);
      this.notice.set('');
      this.error.set('');
      this.errorKind.set(null);
    });
  }

  protected choose(type: 'resenas' | 'reportes') {
    this.message = '';
    this.rating = null;
    this.error.set('');
    this.errorKind.set(null);
    this.notice.set('');
    this.feedback.set(type);
  }

  protected async send(form: NgForm) {
    const type = this.feedback();
    if (!type || this.busy()) return;
    if (type === 'resenas' && this.rating === null) {
      this.errorKind.set('rating');
      this.error.set('Selecciona de 1 a 5 estrellas.');
      return;
    }
    if (form.invalid || this.message.trim().length < 10) {
      this.errorKind.set('message');
      this.error.set('Escribe un mensaje de 10 a 800 caracteres.');
      return;
    }
    this.error.set('');
    this.errorKind.set(null);
    this.busy.set(true);
    const id = this.id();
    try {
      const body = type === 'resenas' ? { message: this.message, rating: this.rating ?? undefined } : { message: this.message };
      await this.catalog.submitFeedback(id, type, body);
      if (this.id() !== id) return;
      this.feedback.set(null);
      if (type === 'resenas') this.reviews.reload();
      this.notice.set(type === 'resenas' ? 'Reseña publicada.' : 'Reporte registrado.');
    } catch (error) {
      if (this.id() === id) {
        const duplicateReport = type === 'reportes' && error instanceof HttpErrorResponse && error.status === 409;
        this.error.set(duplicateReport ? 'Ya reportaste este anuncio.' : apiError(error, 'No pudimos registrar el mensaje.'));
      }
    } finally {
      this.busy.set(false);
    }
  }
}

import { Component, inject, input, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RoomService } from '../../services/room.service';
import { apiError } from '../../services/session.service';
import { roomNavigation } from './room-navigation';
import { normalizeWhatsapp, whatsappUrl } from './room-contact';
import { UiIcon } from '../shared/ui-icon';

@Component({
  imports: [FormsModule, RouterLink, UiIcon],
  templateUrl: './room-contact-page.html',
})
export class RoomContactPage {
  readonly id = input.required<string>();
  protected readonly navigation = roomNavigation();
  private readonly catalog = inject(RoomService);
  protected readonly room = this.catalog.detail(this.id);
  protected readonly contact = this.catalog.contact(this.id);
  protected readonly sent = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly whatsappUrl = whatsappUrl;
  protected inquiry = { name: '', whatsapp: '', email: '', message: '', consent: false };

  protected validWhatsapp() {
    return /^[1-9][0-9]{7,14}$/.test(normalizeWhatsapp(this.inquiry.whatsapp));
  }

  protected async send(form: NgForm) {
    if (this.busy()) return;
    this.error.set('');
    if (form.invalid || !this.validWhatsapp() || !this.inquiry.name.trim() || this.inquiry.message.trim().length < 10) {
      form.control.markAllAsTouched();
      this.error.set('Revisa los campos, escribe al menos 10 caracteres y acepta compartir tus datos.');
      return;
    }
    this.busy.set(true);
    try {
      await this.catalog.sendContact(this.id(), {
        ...this.inquiry,
        whatsapp: normalizeWhatsapp(this.inquiry.whatsapp),
        email: this.inquiry.email.trim() || null,
      });
      this.sent.set(true);
    } catch (error) {
      this.error.set(apiError(error, 'No pudimos enviar la consulta. Intenta nuevamente.'));
    } finally {
      this.busy.set(false);
    }
  }
}

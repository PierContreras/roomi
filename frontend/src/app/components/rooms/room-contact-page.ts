import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RoomService } from '../../services/room.service';

@Component({
  imports: [FormsModule, RouterLink],
  templateUrl: './room-contact-page.html',
})
export class RoomContactPage {
  readonly id = input.required<string>();
  private readonly catalog = inject(RoomService);
  protected readonly room = this.catalog.detail(this.id);
  protected readonly prepared = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected inquiry = { name: '', email: '', message: '' };

  protected async prepare(form: NgForm) {
    if (this.busy()) return;
    this.error.set('');
    if (form.invalid || !this.inquiry.name.trim() || this.inquiry.message.trim().length < 10) {
      form.control.markAllAsTouched();
      this.error.set('Revisa los campos e ingresa una consulta de al menos 10 caracteres.');
      return;
    }
    this.busy.set(true);
    try {
      this.prepared.set(await this.catalog.prepareContact(this.id(), this.inquiry));
    } catch (error) {
      this.error.set(error instanceof HttpErrorResponse && error.status === 404
        ? 'El anuncio ya no está disponible.'
        : 'No pudimos verificar el anuncio. Intenta nuevamente.');
    } finally {
      this.busy.set(false);
    }
  }
}

import { Component, computed, inject, input, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SessionService } from '../../services/session.service';
import { UiIcon } from '../shared/ui-icon';

@Component({
  imports: [FormsModule, RouterLink, UiIcon],
  templateUrl: './access-page.html',
  styleUrl: './access-page.css',
})
export class AccessPage {
  readonly mode = input<'sign-in' | 'register'>('sign-in');
  readonly destino = input<string>();
  readonly retorno = input<string>();
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  protected readonly registering = computed(() => this.mode() === 'register');
  protected readonly contactReturn = computed(() => {
    const target = this.retorno() ?? '';
    return /^\/habitaciones\/[^/?#;]+\/contacto(?:[?#]|$)/.test(target) ? target : '';
  });
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly showConfirmation = signal(false);
  protected details = {
    name: '', email: '', password: '', confirmation: '',
  };

  protected async submit(form: NgForm) {
    if (this.busy()) return;
    this.error.set('');
    if (form.invalid || (this.registering() && !this.details.name.trim())) {
      form.control.markAllAsTouched();
      return;
    }
    if (this.registering() && this.details.password !== this.details.confirmation) {
      form.control.markAllAsTouched();
      return;
    }
    const { name, email, password } = this.details;
    this.busy.set(true);
    try {
      if (this.registering()) await this.session.register(name, email, password);
      else await this.session.signIn(email, password);
      this.enter();
    } catch (error) {
      this.error.set(this.accessError(error));
    } finally {
      this.busy.set(false);
    }
  }

  private accessError(error: unknown): string {
    const action = this.registering() ? 'crear tu cuenta' : 'iniciar sesión';

    if (error instanceof HttpErrorResponse) {
      switch (error.status) {
        case 401:
          return 'El correo o la contraseña son incorrectos. Revisa ambos datos e inténtalo de nuevo.';
        case 409:
          return 'Ya existe una cuenta con este correo. Inicia sesión con ese correo o usa otro para registrarte.';
        case 422:
          return 'Revisa el formato del correo y que la contraseña tenga entre 10 y 64 caracteres.';
        case 0:
          return 'No pudimos conectarnos con ROOMI. Comprueba tu conexión e inténtalo de nuevo.';
      }
    }

    return `El servicio de acceso no está disponible en este momento. Vuelve a intentar ${action} más tarde.`;
  }

  private enter() {
    if (this.session.administrator()) {
      void this.router.navigateByUrl('/administracion');
      return;
    }
    void this.router.navigateByUrl(this.contactReturn() || (this.destino() === 'publicar' ? '/propietario/nuevo' : '/explorar'));
  }
}

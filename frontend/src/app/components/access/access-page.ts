import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DemoUser, Role } from '../../interfaces/user';
import { demoPassword, demoUsers, roleLabels, SessionService } from '../../services/session.service';

@Component({
  imports: [FormsModule, RouterLink],
  templateUrl: './access-page.html',
  styleUrl: './access-page.css',
})
export class AccessPage {
  readonly mode = input<'sign-in' | 'register'>('sign-in');
  readonly destino = input<string>();
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  protected readonly registering = computed(() => this.mode() === 'register');
  protected readonly profiles = demoUsers;
  protected readonly roleLabels = roleLabels;
  protected readonly password = demoPassword;
  protected readonly error = signal('');
  protected readonly registered = signal<DemoUser | null>(null);
  protected details = { name: '', email: '', password: '', role: 'student' as Exclude<Role, 'admin'> };

  protected demo(user: DemoUser) {
    const session = this.session.signIn(user.email, demoPassword);
    if (session) this.enter(session);
  }

  protected submit(form: NgForm) {
    this.error.set('');
    if (form.invalid || (this.registering() && !this.details.name.trim())) {
      form.control.markAllAsTouched();
      this.error.set('Revisa los datos marcados en el formulario.');
      return;
    }
    const { name, email, password, role } = this.details;
    if (this.registering()) {
      const user = this.session.register(name, email, role);
      if (user) this.registered.set(user);
      else this.error.set('Este correo ya corresponde a un perfil de demostración.');
      return;
    }
    const user = this.session.signIn(email, password);
    if (user) this.enter(user);
    else this.error.set('El correo o la contraseña de demostración no coinciden.');
  }

  protected enter(user: DemoUser) {
    const destination = this.destino();
    if (user.role === 'owner') {
      void this.router.navigateByUrl(destination === 'publicar' ? '/propietario/nuevo' : '/propietario');
    } else if (user.role === 'admin') {
      void this.router.navigateByUrl('/administracion');
    } else {
      void this.router.navigateByUrl('/');
    }
  }
}

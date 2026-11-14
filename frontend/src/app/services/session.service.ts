import { Injectable, signal } from '@angular/core';
import { DemoUser, Role } from '../interfaces/user';

export const roleLabels: Record<Role, string> = {
  student: 'Estudiante', owner: 'Propietario', admin: 'Administrador',
};

export const demoPassword = 'roomi123';

export const demoUsers: readonly DemoUser[] = [
  { id: 'demo-student', name: 'Estudiante de demostración', email: 'estudiante@roomi.test', role: 'student' },
  { id: 'demo-owner', name: 'Propietario de demostración', email: 'propietario@roomi.test', role: 'owner' },
  { id: 'demo-admin', name: 'Administrador de demostración', email: 'administrador@roomi.test', role: 'admin' },
];

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly current = signal<DemoUser | null>(null);
  readonly user = this.current.asReadonly();

  signIn(email: string, password: string) {
    const user = demoUsers.find(profile => profile.email === email.trim().toLowerCase());
    if (!user || password !== demoPassword) return null;
    this.current.set(user);
    return user;
  }

  register(name: string, email: string, role: Exclude<Role, 'admin'>) {
    const normalized = email.trim().toLowerCase();
    if (demoUsers.some(profile => profile.email === normalized)) return null;
    const user: DemoUser = { id: 'registered-' + crypto.randomUUID(), name: name.trim(), email: normalized, role };
    this.current.set(user);
    return user;
  }

  signOut() {
    this.current.set(null);
  }
}

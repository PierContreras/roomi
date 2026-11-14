export type Role = 'student' | 'owner' | 'admin';

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

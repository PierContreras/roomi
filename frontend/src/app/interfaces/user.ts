export type Role = 'student' | 'owner';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

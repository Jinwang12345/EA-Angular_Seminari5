export type Rol = 'guest' | 'organizer' | 'speaker';

export interface Participant {
  _id?: string;
  usuario: string;             // id de Usuario
  role?: Rol;
  nombreSnapshot?: string;
  emailSnapshot?: string;
}

export interface Evento {
  _id?: string;
  name: string;
  schedule: string;
  address?: string;
  participantes: Participant[];
}
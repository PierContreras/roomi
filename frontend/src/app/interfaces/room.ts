export const zones = ['San Carlos', 'El Tambo', 'Centro', 'Chilca'] as const;
export const universities = ['Continental', 'UNCP', 'UPLA', 'UTP'] as const;
export const roomTypes = ['Habitación', 'Minidepartamento'] as const;
export const amenities = ['Wifi', 'Baño privado', 'Amoblado', 'Lavandería', 'Cocineta', 'Agua caliente'] as const;
export const statusLabels = {
  pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada', withdrawn: 'Retirada',
} as const;

export type RoomStatus = keyof typeof statusLabels;
export type Zone = typeof zones[number];
export type University = typeof universities[number];
export type RoomType = typeof roomTypes[number];
export type Amenity = typeof amenities[number];

export interface RoomPhoto {
  src: string;
  alt: string;
}

export interface RoomDraft {
  title: string;
  zone: Zone;
  university: University;
  type: RoomType;
  price: number;
  deposit: number;
  minutes: number;
  amenities: readonly Amenity[];
  description: string;
  rules: string;
  address: string;
  photos: readonly RoomPhoto[];
}

export interface PublicRoom extends RoomDraft {
  id: string;
  owner: string;
}

export interface Room extends PublicRoom {
  ownerId: string;
  status: RoomStatus;
  reviewNote?: string;
}

export interface RoomFilters {
  zone: Zone | '';
  university: University | '';
  type: RoomType | '';
  maxPrice: number | null;
  maxMinutes: number | null;
  amenities: readonly Amenity[];
}

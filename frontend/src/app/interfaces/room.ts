export const zones = ['San Carlos', 'El Tambo', 'Centro', 'Chilca'] as const;
export const universities = ['Continental', 'UNCP', 'UPLA', 'UTP'] as const;
export const roomTypes = ['Habitación', 'Minidepartamento'] as const;
export const amenities = ['Wifi', 'Baño privado', 'Amoblado', 'Lavandería', 'Cocineta', 'Agua caliente'] as const;
export const statusLabels = {
  borrador: 'Borrador', en_revision: 'En revisión', publicado: 'Publicado', rechazado: 'Rechazado', retirado: 'Retirado',
} as const;

export type RoomStatus = keyof typeof statusLabels;
export type Zone = typeof zones[number];
export type University = typeof universities[number];
export type RoomType = typeof roomTypes[number];
export type Amenity = typeof amenities[number];

export interface RoomPhoto {
  src: string;
  alt: string;
  illustrative?: boolean;
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
  latitude?: number | null;
  longitude?: number | null;
  distanceKm?: number | null;
  whatsapp?: string | null;
}

export interface PublicRoom extends Omit<RoomDraft, 'whatsapp'> {
  id: string;
  owner: string;
  contactAvailable?: boolean;
}

export interface Room extends PublicRoom {
  whatsapp?: string | null;
  ownerId: string | null;
  status: RoomStatus;
  reviewNote?: string | null;
  revision?: number;
  motivos?: string[];
}

export const moderationReasonLabels: Readonly<Record<string, string>> = {
  datos_invalidos: 'Completa el título y la descripción del anuncio.',
  sin_fotos: 'Agrega al menos una foto.',
  precio_fuera_de_rango: 'El precio mensual está fuera del rango de publicación automática.',
  contacto_externo: 'El título o la descripción incluye datos de contacto externos.',
  termino_prohibido: 'El título o la descripción incluye un término restringido.',
  propietario_suspendido: 'La cuenta del propietario tiene una suspensión activa.',
  reportes_abiertos: 'La cuenta del propietario tiene reportes pendientes.',
  reporte_recibido: 'El anuncio recibió un reporte.',
  cambios_para_revision: 'El equipo revisará los cambios del anuncio.',
};

export interface ListingResult {
  id: string;
  status: RoomStatus;
  motivos: string[];
}

export interface RoomFilters {
  zone: Zone | '';
  university: University | '';
  type: RoomType | '';
  maxPrice: number | null;
  maxMinutes: number | null;
  maxDistance: number | null;
  amenities: readonly Amenity[];
}

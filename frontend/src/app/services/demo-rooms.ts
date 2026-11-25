import { Room } from '../interfaces/room';

const defaults = {
  ownerId: 'demo-owner',
  owner: 'Propietario de demostración',
  status: 'publicado',
  rules: 'Coordina la visita con el propietario. El pago de la renta y la garantía se acuerdan durante la visita.',
  photos: [],
} as const;

const sanCarlos: Room = {
  ...defaults, id: 'san-carlos-320', title: 'Cuarto iluminado con escritorio y baño propio',
  zone: 'San Carlos', university: 'Continental', type: 'Habitación', price: 320, deposit: 150, minutes: 8,
  amenities: ['Baño privado', 'Wifi', 'Amoblado', 'Agua caliente'],
  description: 'Incluye luz, agua caliente y wifi de alta velocidad. Entrada independiente y espacio para estudiar.',
  address: 'Pasaje del Estudio 120, San Carlos',
};

const elTambo: Room = {
  ...defaults, id: 'el-tambo-480', title: 'Minidepa para 1 o 2 estudiantes con cocineta',
  zone: 'El Tambo', university: 'UNCP', type: 'Minidepartamento', price: 480, deposit: 240, minutes: 12,
  amenities: ['Wifi', 'Cocineta', 'Lavandería'],
  description: 'Espacio con luz natural, cocineta equipada y zona de lavandería compartida.',
  address: 'Jirón Los Cuadernos 240, El Tambo',
};

const centro: Room = {
  ...defaults, id: 'centro-260', title: 'Habitación amoblada con cama y ropero',
  zone: 'Centro', university: 'UPLA', type: 'Habitación', price: 260, deposit: 100, minutes: 15,
  amenities: ['Amoblado', 'Wifi'],
  description: 'A pasos del transporte público, con mobiliario y acceso independiente.',
  address: 'Pasaje La Biblioteca 15, Centro',
};

export const demoRooms: readonly Room[] = [
  sanCarlos, elTambo, centro,
  { ...sanCarlos, id: 'luminosa-350', title: 'Habitación luminosa cerca del campus', price: 350, deposit: 175, minutes: 10, amenities: ['Amoblado', 'Lavandería'], address: 'Alameda del Campus 48, San Carlos' },
  { ...centro, id: 'chilca-en-revision', title: 'Habitación independiente en Chilca', zone: 'Chilca', university: 'UTP', status: 'en_revision', address: 'Pasaje Los Apuntes 35, Chilca' },
  { ...elTambo, id: 'tambo-observado', title: 'Minidepartamento con ingreso independiente', status: 'rechazado', reviewNote: 'Completa las condiciones de alquiler antes de reenviar.' },
];

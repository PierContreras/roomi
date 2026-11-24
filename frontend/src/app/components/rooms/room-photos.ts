import { PublicRoom, RoomPhoto } from '../../interfaces/room';

const demoAds = new Set(['san-carlos-320', 'el-tambo-480', 'centro-260', 'luminosa-350']);

export function roomPhotos(room: PublicRoom): readonly RoomPhoto[] {
  if (room.photos.length || !demoAds.has(room.id) || room.contactAvailable) return room.photos;
  return [{
    src: `/demo-rooms/${room.id}.jpg`,
    alt: 'Imagen ilustrativa de un alojamiento estudiantil',
    illustrative: true,
  }];
}

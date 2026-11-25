import { Zone } from '../../interfaces/room';

export type MapPoint = [number, number];

// Puntos de referencia de zona en Huancayo.
export const zonePoints: Record<Zone, MapPoint> = {
  Centro: [-12.068, -75.210],
  'El Tambo': [-12.057, -75.216],
  'San Carlos': [-12.058, -75.204],
  Chilca: [-12.087, -75.208],
};

export function isHuancayoPoint(latitude: number | null | undefined, longitude: number | null | undefined): boolean {
  return latitude != null && longitude != null &&
    latitude >= -12.22 && latitude <= -11.92 && longitude >= -75.36 && longitude <= -75.06;
}

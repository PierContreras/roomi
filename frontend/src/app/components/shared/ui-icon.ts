import { Component, input } from '@angular/core';
import type { Amenity } from '../../interfaces/room';

const paths = {
  search: 'M21 21l-5.2-5.2M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z',
  home: 'm3 10 9-7 9 7v10H3Zm6 10v-7h6v7',
  heart: 'M20.8 4.6a5.2 5.2 0 0 0-7.4 0L12 6l-1.4-1.4a5.2 5.2 0 0 0-7.4 7.4L12 21l8.8-9a5.2 5.2 0 0 0 0-7.4Z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'm6 6 12 12M18 6 6 18',
  pin: 'M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Zm-5 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  campus: 'm2 9 10-5 10 5-10 5ZM6 11v6c3 3 9 3 12 0v-6m4-2v7',
  filters: 'M4 6h5m4 0h7M4 12h10m4 0h2M4 18h2m4 0h10M9 4v4m5 2v4m-8 2v4',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.1M4 12h.1M4 18h.1',
  map: 'm3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3ZM9 3v15m6-12v15',
  compare: 'M3 3v18h18M8 16v-4m5 4V7m5 9v-6',
  clock: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM12 6v6l4 2',
  share: 'M12 15V3m-4 4 4-4 4 4M5 11v9h14v-9',
  external: 'M13 4h7v7m0-7-9 9m7 0v7H4V6h7',
  message: 'M4 4h16v12H9l-5 4Zm4 5h8m-8 4h5',
  whatsapp: 'M7.4 19.8 3 21l1.2-4.4A9 9 0 1 1 7.4 19.8ZM9 7.2c-.6 0-1.4 1-1.4 2.1 0 2.5 3 5.8 5.7 6.7 1.5.5 3 .2 3.4-.8l.3-1-2.9-1.4-.9 1c-1.4-.5-2.4-1.4-3-2.8l.9-1-1.4-2.8Z',
  wifi: 'M3 8a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0m-9 4a5 5 0 0 1 6 0m-3 4h.01',
  shower: 'M4 20V7a4 4 0 0 1 8 0v1m-4 3h8l-2-3h-4Zm1 4v1m3-1v1m3-1v1m-6 3v1m3-1v1m3-1v1',
  bed: 'M3 18V7m0 8h18v5m-18 0v-2h18M7 15v-4h4a2 2 0 0 1 2 2v2m0-4h5a3 3 0 0 1 3 3v1',
  washer: 'M5 3h14v18H5Zm0 5h14m-11-2h.01m3 0h.01m5 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  kitchen: 'M4 3v6a3 3 0 0 0 6 0V3M7 3v18m11 0V3c-3 3-4 7-4 10h4',
  water: 'M12 3c4 5 7 8 7 12a7 7 0 0 1-14 0c0-4 3-7 7-12Zm-3 13c0 1.7 1.3 3 3 3',
  eye: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  eyeOff: 'm3 3 18 18M10 6.2c.6-.1 1.3-.2 2-.2 6.5 0 10 6 10 6s-1 1.8-3 3.4M6 7.8C3.4 9.5 2 12 2 12s3.5 6 10 6c1.3 0 2.5-.2 3.6-.7',
  chevronLeft: 'm15 18-6-6 6-6',
  chevronRight: 'm9 18 6-6-6-6',
  chevronDown: 'm6 9 6 6 6-6',
  signOut: 'M10 17l5-5-5-5m5 5H3m9-8h8v16h-8',
  photo: 'M3 4h18v16H3Zm0 12 5-5 4 4 3-3 6 6M15 8h.01',
  plus: 'M12 5v14M5 12h14',
  user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v2',
  help: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM9 9a3 3 0 1 1 4.4 2.6c-1 .6-1.4 1.1-1.4 2.4m0 3h.01',
} as const;

export const amenityIcons = {
  Wifi: 'wifi',
  'Baño privado': 'shower',
  Amoblado: 'bed',
  Lavandería: 'washer',
  Cocineta: 'kitchen',
  'Agua caliente': 'water',
} as const satisfies Record<Amenity, keyof typeof paths>;

@Component({
  selector: 'app-ui-icon',
  host: { 'aria-hidden': 'true' },
  template: `
    <svg viewBox="0 0 24 24" [attr.fill]="filled() ? 'currentColor' : 'none'"
      stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" focusable="false">
      <path [attr.d]="paths[name()]" />
    </svg>
  `,
  styles: [':host { display: inline-flex; width: 1.2em; height: 1.2em; flex: none; vertical-align: middle; } svg { width: 100%; height: 100%; }'],
})
export class UiIcon {
  readonly name = input.required<keyof typeof paths>();
  readonly filled = input(false);
  protected readonly paths = paths;
}

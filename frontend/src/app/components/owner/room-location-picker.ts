import { isPlatformBrowser } from '@angular/common';
import { DOCUMENT, PLATFORM_ID, Component, ElementRef, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { Zone } from '../../interfaces/room';
import { LeafletMap, LeafletMarker, UiLibraries } from '../../services/ui-libraries';
import { isHuancayoPoint, MapPoint, zonePoints } from '../rooms/room-location';

@Component({
  selector: 'app-room-location-picker',
  template: `
    @if (!unavailable()) {
      <div #canvas class="picker-map" aria-label="Mapa para elegir una ubicación referencial"></div>
    }
    @if (unavailable()) {
      <p role="status">El mapa no está disponible. Usa la opción de ingresar coordenadas.</p>
    } @else if (map()) {
      <div class="actions">
        <button type="button" class="button quiet" (click)="markCenter()">Marcar el centro del mapa</button>
      </div>
    } @else {
      <p role="status">Cargando mapa…</p>
    }
    <p class="small" aria-live="polite">{{ notice() }}</p>
  `,
  styles: ['.picker-map { height: clamp(240px, 45vh, 400px); border-radius: 12px; margin-bottom: 12px; }'],
})
export class RoomLocationPicker {
  readonly zone = input.required<Zone>();
  readonly latitude = input<number | null | undefined>();
  readonly longitude = input<number | null | undefined>();
  private readonly point = computed<MapPoint | null>(() => {
    const lat = this.latitude(), lng = this.longitude();
    return lat != null && lng != null && isHuancayoPoint(lat, lng) ? [lat, lng] : null;
  });
  readonly pointChange = output<MapPoint>();
  private readonly libraries = inject(UiLibraries);
  private readonly document = inject(DOCUMENT);
  private readonly canvas = viewChild<ElementRef<HTMLElement>>('canvas');
  protected readonly map = signal<LeafletMap | null>(null);
  protected readonly unavailable = signal(false);
  protected readonly notice = signal('');
  private readonly marker = signal<LeafletMarker | null>(null);

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    effect(onCleanup => {
      const canvas = this.canvas()?.nativeElement;
      const center = zonePoints[this.zone()];
      if (!canvas) return;
      let cancelled = false;
      let active: LeafletMap | undefined;
      onCleanup(() => {
        cancelled = true;
        active?.remove();
        this.map.set(null);
        this.marker.set(null);
      });
      void this.libraries.leaflet().then(leaflet => {
        if (cancelled) return;
        if (!leaflet) {
          this.unavailable.set(true);
          return;
        }
        active = leaflet.map(canvas, { scrollWheelZoom: false, zoomControl: true, zoomAnimation: false });
        const point = this.point();
        active.setView(point ?? center, 15);
        leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(active).on('tileerror', () => {
          if (!cancelled) this.notice.set('El mapa base puede verse incompleto. Puedes ingresar las coordenadas.');
        });
        active.on('click', ({ latlng }) => this.select(latlng.lat, latlng.lng));
        const dot = this.document.createElement('span');
        dot.style.cssText = 'display:block;width:18px;height:18px;border:3px solid white;border-radius:50%;background:#10574f;box-shadow:0 1px 5px #102b2d';
        const marker = leaflet.marker(point ?? center, {
          icon: leaflet.divIcon({ html: dot, iconSize: [18, 18], className: 'room-location-pin' }),
          keyboard: false,
        }).addTo(active);
        this.marker.set(marker);
        this.map.set(active);
      }).catch(() => { if (!cancelled) this.unavailable.set(true); });
    });

    effect(() => {
      const point = this.point();
      const marker = this.marker();
      if (!marker) return;
      marker.setOpacity(point ? 1 : 0);
      if (point) marker.setLatLng(point);
    });
  }

  protected markCenter() {
    const center = this.map()?.getCenter();
    if (center) this.select(center.lat, center.lng);
  }

  private select(latitude: number, longitude: number) {
    if (!isHuancayoPoint(latitude, longitude)) {
      this.notice.set('Elige un punto dentro de Huancayo o sus alrededores.');
      return;
    }
    this.pointChange.emit([Number(latitude.toFixed(5)), Number(longitude.toFixed(5))]);
    this.notice.set('Ubicación referencial marcada.');
  }
}

import { isPlatformBrowser } from '@angular/common';
import { DOCUMENT, PLATFORM_ID, Component, ElementRef, computed, effect, inject, input, model, signal, viewChild } from '@angular/core';
import { Params, RouterLink } from '@angular/router';
import { PublicRoom } from '../../interfaces/room';
import { LeafletMap, LeafletMarker, UiLibraries } from '../../services/ui-libraries';
import { roomPhotos } from './room-photos';
import { isHuancayoPoint, MapPoint, zonePoints } from './room-location';

interface MapEntry {
  room: PublicRoom;
  point: MapPoint;
  approximate: boolean;
}

interface MarkerControl {
  button: HTMLButtonElement;
  marker: LeafletMarker;
}

@Component({
  selector: 'app-room-map',
  imports: [RouterLink],
  templateUrl: './room-map.html',
  styleUrl: './room-map.css',
})
export class RoomMap {
  readonly rooms = input.required<readonly PublicRoom[]>();
  readonly detailQuery = input<Params>({});
  readonly showListingLinks = input(true);
  readonly selected = model('');
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly libraries = inject(UiLibraries);
  private readonly canvas = viewChild<ElementRef<HTMLElement>>('mapCanvas');
  private readonly activeMap = signal<LeafletMap | null>(null);
  private readonly controls = new Map<string, MarkerControl>();
  protected readonly ready = computed(() => this.activeMap() !== null);
  protected readonly mapError = signal(false);
  protected readonly tileError = signal(false);
  protected readonly entries = computed<MapEntry[]>(() => this.rooms().map(room => {
    const { latitude, longitude } = room;
    if (latitude != null && longitude != null && isHuancayoPoint(latitude, longitude)) {
      return { room, point: [latitude, longitude], approximate: false };
    }
    return { room, point: zonePoints[room.zone], approximate: true };
  }));
  protected readonly hasApproximate = computed(() => this.entries().some(entry => entry.approximate));
  protected readonly preview = computed(() => this.entries().find(({ room }) => room.id === this.selected()));
  protected readonly previewPhoto = computed(() => {
    const entry = this.preview();
    return entry ? roomPhotos(entry.room)[0] : undefined;
  });

  constructor() {
    if (!this.browser) return;
    effect(onCleanup => {
      const canvas = this.canvas()?.nativeElement;
      const entries = this.entries();
      if (!canvas) return;

      let cancelled = false;
      let map: LeafletMap | undefined;
      let observer: ResizeObserver | undefined;
      this.activeMap.set(null);
      this.mapError.set(false);
      this.tileError.set(false);
      onCleanup(() => {
        cancelled = true;
        observer?.disconnect();
        map?.remove();
        this.controls.clear();
      });

      void this.libraries.leaflet().then(leaflet => {
        if (cancelled) return;
        if (!leaflet) {
          this.mapError.set(true);
          return;
        }
        const currentMap = leaflet.map(canvas, {
          scrollWheelZoom: false, zoomControl: false, zoomAnimation: !this.reducedMotion(),
        });
        map = currentMap;
        this.fit(currentMap, entries);
        leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(currentMap).on('tileerror', () => { if (!cancelled) this.tileError.set(true); });

        const groups = new Map<string, MapEntry[]>();
        for (const entry of entries) {
          const key = entry.point.join(',');
          const group = groups.get(key) ?? [];
          group.push(entry);
          groups.set(key, group);
        }

        for (const group of groups.values()) {
          const stack = this.document.createElement('div');
          stack.className = 'room-map-prices';
          leaflet.DomEvent.disableClickPropagation(stack);
          const marker = leaflet.marker(group[0].point, {
            keyboard: false,
            icon: leaflet.divIcon({ html: stack, iconSize: [0, 0], className: 'room-map-marker' }),
          }).addTo(currentMap);
          for (const entry of group) {
            const button = this.priceButton(entry);
            button.addEventListener('focus', () => currentMap.panInside(entry.point, { padding: [72, 96], animate: false }));
            stack.append(button);
            this.controls.set(entry.room.id, { button, marker });
          }
        }
        if (typeof ResizeObserver !== 'undefined') {
          observer = new ResizeObserver(() => currentMap.invalidateSize({ pan: false }));
          observer.observe(canvas);
        }
        this.activeMap.set(currentMap);
      }).catch(() => { if (!cancelled) this.mapError.set(true); });
    });

    effect(() => {
      const map = this.activeMap();
      const entry = this.preview();
      if (!map) return;
      const selectedControl = entry ? this.controls.get(entry.room.id) : undefined;
      for (const { button, marker } of this.controls.values()) {
        button.setAttribute('aria-pressed', String(button === selectedControl?.button));
        marker.setZIndexOffset(marker === selectedControl?.marker ? 500 : 0);
      }
      if (entry && this.showListingLinks()) {
        this.centerOn(map, entry);
      }
    });
  }

  protected fitResults() {
    const map = this.activeMap();
    if (map) this.fit(map, this.entries());
  }

  protected centerPreview() {
    const map = this.activeMap();
    const entry = this.preview();
    if (map && entry) this.centerOn(map, entry);
  }

  private centerOn(map: LeafletMap, entry: MapEntry) {
    map.setView(entry.point, entry.approximate ? 15 : 16, { animate: !this.reducedMotion() });
  }

  protected zoom(direction: 'in' | 'out') {
    const options = { animate: !this.reducedMotion() };
    if (direction === 'in') this.activeMap()?.zoomIn(1, options);
    else this.activeMap()?.zoomOut(1, options);
  }

  protected mapsUrl(entry: MapEntry) {
    const query = entry.approximate ? entry.room.zone + ', Huancayo, Perú' : entry.point.join(',');
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query);
  }

  private priceButton({ room, approximate }: MapEntry): HTMLButtonElement {
    const button = this.document.createElement('button');
    button.type = 'button';
    button.className = 'room-map-price';
    button.textContent = (approximate ? '≈ ' : '') + 'S/ ' + room.price;
    button.setAttribute('aria-label', room.title + ', S/ ' + room.price +
      (approximate ? ', ubicación aproximada en ' + room.zone : ', ' + room.zone));
    button.addEventListener('click', () => this.selected.set(room.id));
    return button;
  }

  private fit(map: LeafletMap, entries: MapEntry[]) {
    const points = entries.map(entry => entry.point);
    if (points.length > 1) map.fitBounds(points, { padding: [32, 48], maxZoom: 15, animate: false });
    else map.setView(points[0] ?? zonePoints.Centro, points.length ? 15 : 13, { animate: false });
  }

  private reducedMotion(): boolean {
    return this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }
}

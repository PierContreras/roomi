import { DOCUMENT, Injectable, inject } from '@angular/core';

interface AlertOptions {
  icon: 'success' | 'warning';
  title: string;
  text?: string;
  toast?: boolean;
  position?: 'top-end';
  timer?: number;
  showConfirmButton?: boolean;
  showCancelButton?: boolean;
  confirmButtonText?: string;
  cancelButtonText?: string;
  confirmButtonColor?: string;
  focusCancel?: boolean;
}

interface SweetAlert {
  fire(options: AlertOptions): Promise<{ isConfirmed: boolean }>;
}

interface PriceChart {
  destroy(): void;
}

interface PriceChartOptions {
  type: 'bar';
  data: {
    labels: string[];
    datasets: { data: [number, number][]; backgroundColor: string; borderRadius: number; minBarLength: number }[];
  };
  options: {
    indexAxis: 'y';
    responsive: boolean;
    maintainAspectRatio: boolean;
    animation: false;
    scales: { x: { ticks: { callback: (value: string | number) => string } } };
    plugins: {
      legend: { display: false };
      tooltip: { callbacks: { label: (item: { dataIndex: number }) => string } };
    };
  };
}

type ChartConstructor = new (canvas: HTMLCanvasElement, options: PriceChartOptions) => PriceChart;
type Coordinates = [number, number];

export interface LeafletMap {
  setView(center: Coordinates, zoom: number, options?: { animate: boolean }): this;
  fitBounds(points: Coordinates[], options: { padding: Coordinates; maxZoom: number; animate: boolean }): this;
  panInside(point: Coordinates, options: { padding: Coordinates; animate: boolean }): this;
  zoomIn(delta: number, options: { animate: boolean }): this;
  zoomOut(delta: number, options: { animate: boolean }): this;
  invalidateSize(options: { pan: boolean }): this;
  remove(): void;
}

interface Layer {
  addTo(map: LeafletMap): this;
  on(event: 'tileerror', callback: () => void): this;
}

interface LeafletIcon {
  createIcon(): HTMLElement;
}

export interface LeafletMarker {
  addTo(map: LeafletMap): this;
  setZIndexOffset(offset: number): this;
}

interface Leaflet {
  map(container: HTMLElement, options: { scrollWheelZoom: boolean; zoomControl: boolean; zoomAnimation: boolean }): LeafletMap;
  tileLayer(url: string, options: { maxZoom: number; attribution: string }): Layer;
  divIcon(options: { html: HTMLElement; iconSize: Coordinates; className: string }): LeafletIcon;
  marker(point: Coordinates, options: { icon: LeafletIcon; keyboard: boolean }): LeafletMarker;
  DomEvent: { disableClickPropagation(element: HTMLElement): void };
}

type LibraryWindow = Window & { Swal?: SweetAlert; Chart?: ChartConstructor; L?: Leaflet };

@Injectable({ providedIn: 'root' })
export class UiLibraries {
  private readonly document = inject(DOCUMENT);
  private readonly pending = new Map<string, Promise<void>>();

  async confirm(title: string, text: string, confirmButtonText: string) {
    try {
      const swal = await this.alert();
      if (!swal) return undefined;
      const result = await swal.fire({
        icon: 'warning', title, text, confirmButtonText, cancelButtonText: 'Cancelar',
        confirmButtonColor: '#902837', showCancelButton: true, focusCancel: true,
      });
      return result.isConfirmed;
    } catch {
      return undefined;
    }
  }

  async success(title: string) {
    try {
      const swal = await this.alert();
      await swal?.fire({ title, icon: 'success', toast: true, position: 'top-end', timer: 3000, showConfirmButton: false });
    } catch {
      // The page also shows the result in text.
    }
  }

  async chart() {
    const window = this.document.defaultView as LibraryWindow | null;
    if (!window) return undefined;
    if (!window.Chart) await this.load('https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js');
    return window.Chart;
  }

  async leaflet() {
    const window = this.document.defaultView as LibraryWindow | null;
    if (!window) return undefined;
    const base = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet';
    const css = base + '.css';
    if (!this.document.querySelector(`link[href="${css}"]`)) {
      const link = this.document.createElement('link');
      link.rel = 'stylesheet';
      link.href = css;
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = 'anonymous';
      this.document.head.append(link);
    }
    if (!window.L) await this.load(base + '.js', 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=');
    return window.L;
  }

  private async alert() {
    const window = this.document.defaultView as LibraryWindow | null;
    if (!window) return undefined;
    if (!window.Swal) await this.load('https://cdn.jsdelivr.net/npm/sweetalert2@11.26.5/dist/sweetalert2.all.min.js');
    return window.Swal;
  }

  private load(url: string, integrity?: string) {
    const existing = this.pending.get(url);
    if (existing) return existing;
    const request = new Promise<void>(resolve => {
      const script = this.document.createElement('script');
      const finish = (loaded: boolean) => {
        clearTimeout(timeout);
        script.onload = null;
        script.onerror = null;
        if (!loaded) script.remove();
        resolve();
      };
      const timeout = setTimeout(() => finish(false), 2500);
      script.src = url;
      if (integrity) {
        script.integrity = integrity;
        script.crossOrigin = 'anonymous';
      }
      script.onload = () => finish(true);
      script.onerror = () => finish(false);
      this.document.head.append(script);
    });
    this.pending.set(url, request);
    void request.finally(() => this.pending.delete(url));
    return request;
  }
}

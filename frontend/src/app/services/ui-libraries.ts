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
type LibraryWindow = Window & { Swal?: SweetAlert; Chart?: ChartConstructor };

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

  private async alert() {
    const window = this.document.defaultView as LibraryWindow | null;
    if (!window) return undefined;
    if (!window.Swal) await this.load('https://cdn.jsdelivr.net/npm/sweetalert2@11.26.5/dist/sweetalert2.all.min.js');
    return window.Swal;
  }

  private load(url: string) {
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
      script.onload = () => finish(true);
      script.onerror = () => finish(false);
      this.document.head.append(script);
    });
    this.pending.set(url, request);
    void request.finally(() => this.pending.delete(url));
    return request;
  }
}

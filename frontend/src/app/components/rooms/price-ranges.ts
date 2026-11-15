import { Component, ElementRef, afterRenderEffect, computed, inject, input, viewChild } from '@angular/core';
import { PublicRoom, zones } from '../../interfaces/room';
import { UiLibraries } from '../../services/ui-libraries';

const soles = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

@Component({
  selector: 'app-price-ranges',
  templateUrl: './price-ranges.html',
  styles: [`
    :host { display: block; margin-bottom: 18px; }
    .chart { position: relative; height: 200px; }
    table { width: 100%; border-collapse: collapse; font-size: .875rem; text-align: left; }
    th, td { padding: 8px 6px; border-bottom: 1px solid var(--border); }
  `],
})
export class PriceRanges {
  readonly rooms = input.required<readonly PublicRoom[]>();
  private readonly libraries = inject(UiLibraries);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  protected readonly ranges = computed(() => zones.flatMap(zone => {
    const prices = this.rooms().filter(room => room.zone === zone).map(room => room.price);
    return prices.length ? [{ zone, min: Math.min(...prices), max: Math.max(...prices), count: prices.length }] : [];
  }));
  protected readonly money = (price: number) => soles.format(price);

  constructor() {
    afterRenderEffect({
      mixedReadWrite: onCleanup => {
        const canvas = this.canvas().nativeElement;
        const ranges = this.ranges();
        let active = true;
        let chart: { destroy(): void } | undefined;
        canvas.parentElement!.hidden = true;
        onCleanup(() => {
          active = false;
          chart?.destroy();
        });
        void this.libraries.chart().then(Chart => {
          if (!Chart || !active) return;
          canvas.parentElement!.hidden = false;
          try {
            chart = new Chart(canvas, {
              type: 'bar',
              data: {
                labels: ranges.map(range => range.zone),
                datasets: [{
                  data: ranges.map(range => [range.min, range.max]),
                  backgroundColor: '#28776e', borderRadius: 5, minBarLength: 4,
                }],
              },
              options: {
                indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: false,
                scales: { x: { ticks: { callback: value => `S/ ${value}` } } },
                plugins: {
                  legend: { display: false },
                  tooltip: { callbacks: { label: ({ dataIndex }) => {
                    const { min, max } = ranges[dataIndex];
                    return min === max ? this.money(min) : `${this.money(min)} a ${this.money(max)}`;
                  } } },
                },
              },
            });
          } catch {
            canvas.parentElement!.hidden = true;
          }
        });
      },
    });
  }
}

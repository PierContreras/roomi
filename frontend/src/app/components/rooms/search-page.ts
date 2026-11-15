import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Params, Router, RouterLink } from '@angular/router';
import { PublicRoom, RoomFilters, amenities, roomTypes, universities, zones } from '../../interfaces/room';
import { RoomCard } from './room-card';
import { RoomMap } from './room-map';
import { RoomService } from '../../services/room.service';
import { emptyFilters, SearchFilters } from './search-filters';
import { filterParamKeys, searchQuery } from './room-navigation';
import { PriceRanges } from './price-ranges';
import { UiIcon } from '../shared/ui-icon';

function selectValue<T extends string>(options: readonly T[], value: string | null): T | '' {
  return options.find(option => option === value) ?? '';
}

function nonNegative(value: string | null): number | null {
  if (!value?.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

@Component({
  imports: [SearchFilters, RoomCard, RoomMap, RouterLink, PriceRanges, UiIcon],
  templateUrl: './search-page.html',
  styleUrl: './search-page.css',
})
export class SearchPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly catalog = inject(RoomService);
  private request = 0;
  protected readonly filters = signal(emptyFilters);
  protected readonly filterLabels = computed(() => {
    const { zone, university, type, maxPrice, maxMinutes, amenities } = this.filters();
    const labels: { label: string; remove: Params }[] = [];
    if (zone) labels.push({ label: zone, remove: { zona: null } });
    if (university) labels.push({ label: university, remove: { universidad: null } });
    if (type) labels.push({ label: type, remove: { tipo: null } });
    if (maxPrice !== null) labels.push({ label: `Hasta S/ ${maxPrice}`, remove: { precio: null } });
    if (maxMinutes !== null) labels.push({ label: `Hasta ${maxMinutes} min al campus`, remove: { minutos: null } });
    for (const amenity of amenities) {
      labels.push({ label: amenity, remove: { servicio: amenities.filter(item => item !== amenity) } });
    }
    return labels;
  });
  protected readonly clearFilters = Object.fromEntries(filterParamKeys.map(key => [key, null]));
  protected readonly rooms = signal<readonly PublicRoom[]>([]);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly showMap = computed(() => this.params().get('vista') === 'mapa');
  protected readonly mapZone = computed(() => this.params().get('zonaMapa') ?? '');
  protected readonly detailQuery = computed(() => ({ ...searchQuery(this.params()), origen: 'buscar' }));
  protected readonly showChart = signal(false);
  protected readonly sort = computed(() => {
    const value = this.params().get('orden');
    return value === 'precio' || value === 'distancia' ? value : '';
  });
  protected readonly orderedRooms = computed(() => {
    const rooms = this.rooms();
    switch (this.sort()) {
      case 'precio': return [...rooms].sort((a, b) => a.price - b.price);
      case 'distancia': return [...rooms].sort((a, b) => a.minutes - b.minutes);
      default: return rooms;
    }
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const key = JSON.stringify(filterParamKeys.map(name => params.getAll(name)));
      if (key === this.filterKey) return;
      this.filterKey = key;
      this.loadParams(params);
    });
  }

  private filterKey = '';

  protected changeView(queryParams: Params) {
    void this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected apply(filters: RoomFilters) {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'merge',
      queryParams: {
        zona: filters.zone || null, universidad: filters.university || null, tipo: filters.type || null,
        precio: filters.maxPrice, minutos: filters.maxMinutes, servicio: filters.amenities.length ? filters.amenities : null,
      },
    });
  }

  private loadParams(params: ParamMap) {
    const minutes = nonNegative(params.get('minutos'));
    this.filters.set({
      zone: selectValue(zones, params.get('zona')),
      university: selectValue(universities, params.get('universidad')),
      type: selectValue(roomTypes, params.get('tipo')),
      maxPrice: nonNegative(params.get('precio')),
      maxMinutes: Number.isInteger(minutes) ? minutes : null,
      amenities: amenities.filter(amenity => params.getAll('servicio').includes(amenity)),
    });
    void this.load();
  }

  protected async load() {
    const request = ++this.request;
    this.state.set('loading');
    try {
      const rooms = await this.catalog.search(this.filters());
      if (request !== this.request) return;
      this.rooms.set(rooms);
      this.state.set('ready');
    } catch {
      if (request === this.request) this.state.set('error');
    }
  }
}

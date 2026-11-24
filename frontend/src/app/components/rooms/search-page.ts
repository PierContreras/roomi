import { Component, ElementRef, Injector, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
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
  private readonly injector = inject(Injector);
  protected readonly catalog = inject(RoomService);
  private request = 0;
  protected readonly filters = signal(emptyFilters);
  protected readonly filterLabels = computed(() => {
    const { zone, university, type, maxPrice, maxMinutes, maxDistance, amenities } = this.filters();
    const labels: { label: string; remove: Params }[] = [];
    if (zone) labels.push({ label: zone, remove: { zona: null } });
    if (university) labels.push({ label: university, remove: { universidad: null } });
    if (type) labels.push({ label: type, remove: { tipo: null } });
    if (maxPrice !== null) labels.push({ label: `Hasta S/ ${maxPrice}`, remove: { precio: null } });
    if (maxDistance !== null) labels.push({ label: `Hasta ${maxDistance} km al campus`, remove: { distancia: null } });
    if (maxMinutes !== null) labels.push({ label: `Hasta ${maxMinutes} min al campus`, remove: { minutos: null } });
    for (const amenity of amenities) {
      labels.push({ label: amenity, remove: { servicio: amenities.filter(item => item !== amenity) } });
    }
    return labels;
  });
  protected readonly clearFilters = Object.fromEntries(filterParamKeys.map(key => [key, null]));
  protected readonly rooms = signal<readonly PublicRoom[]>([]);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly searchError = signal('');
  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly showMap = computed(() => this.params().get('vista') === 'mapa');
  protected readonly resultZones = zones;
  protected readonly selectedRoom = signal('');
  private readonly resultList = viewChild<ElementRef<HTMLElement>>('resultList');
  private readonly mapPanel = viewChild('mapPanel', { read: ElementRef<HTMLElement> });
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
    return this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected showOnMap(id: string) {
    this.selectedRoom.set(id);
    if (!this.showMap()) this.switchResultView(true, () => this.mapPanel()?.nativeElement);
  }

  protected showList() {
    const id = this.selectedRoom();
    this.switchResultView(false, () => this.findCard(id)?.querySelector<HTMLButtonElement>('button.locate') ?? undefined);
  }

  private switchResultView(map: boolean, target: () => HTMLElement | undefined) {
    const browser = this.resultList()?.nativeElement.ownerDocument.defaultView;
    const mobile = browser?.matchMedia?.('(max-width: 940px)').matches;
    const changed = this.showMap() !== map;
    void this.changeView({ vista: map ? 'mapa' : null }).then(navigated => {
      if (!mobile || !changed || !navigated) return;
      afterNextRender(() => {
        const element = target();
        element?.focus({ preventScroll: true });
        element?.scrollIntoView({ block: 'nearest' });
      }, { injector: this.injector });
    });
  }

  private findCard(id: string): HTMLElement | undefined {
    const list = this.resultList()?.nativeElement;
    if (!list || !id) return undefined;
    return [...list.querySelectorAll<HTMLElement>('[data-room-id]')].find(card => card.dataset['roomId'] === id);
  }

  protected selectFromMap(id: string) {
    this.selectedRoom.set(id);
    const list = this.resultList()?.nativeElement;
    if (!list?.clientHeight || list.scrollHeight <= list.clientHeight) return;
    const card = this.findCard(id);
    if (!card) return;
    const bounds = list.getBoundingClientRect();
    const target = card.getBoundingClientRect();
    if (target.top >= bounds.top && target.bottom <= bounds.bottom) return;
    const reducedMotion = list.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    list.scrollTo({ top: list.scrollTop + target.top - bounds.top, behavior: reducedMotion ? 'instant' : 'smooth' });
  }

  protected apply(filters: RoomFilters) {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'merge',
      queryParams: {
        zona: filters.zone || null, universidad: filters.university || null, tipo: filters.type || null,
        precio: filters.maxPrice, minutos: filters.maxMinutes, distancia: filters.maxDistance, servicio: filters.amenities.length ? filters.amenities : null,
      },
    });
  }

  private loadParams(params: ParamMap) {
    const minutes = nonNegative(params.get('minutos'));
    const distance = nonNegative(params.get('distancia'));
    this.filters.set({
      zone: selectValue(zones, params.get('zona')),
      university: selectValue(universities, params.get('universidad')),
      type: selectValue(roomTypes, params.get('tipo')),
      maxPrice: nonNegative(params.get('precio')),
      maxMinutes: Number.isInteger(minutes) ? minutes : null,
      maxDistance: distance !== null && distance <= 100 ? distance : null,
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
      if (!rooms.some(room => room.id === this.selectedRoom())) this.selectedRoom.set('');
      this.rooms.set(rooms);
      this.state.set('ready');
    } catch (error) {
      if (request !== this.request) return;
      this.searchError.set(error instanceof HttpErrorResponse && error.status === 422
        ? 'Revisa los valores de los filtros y vuelve a buscar.'
        : 'No pudimos cargar el catálogo. Vuelve a intentar con los mismos filtros.');
      this.state.set('error');
    }
  }
}

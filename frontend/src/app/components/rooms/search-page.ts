import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { PublicRoom, RoomFilters, amenities, roomTypes, universities, zones } from '../../interfaces/room';
import { RoomCard } from './room-card';
import { RoomMap } from './room-map';
import { RoomService } from '../../services/room.service';
import { emptyFilters, SearchFilters } from './search-filters';

function selectValue<T extends string>(options: readonly T[], value: string | null): T | '' {
  return options.find(option => option === value) ?? '';
}

function nonNegative(value: string | null): number | null {
  if (!value?.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

@Component({
  imports: [SearchFilters, RoomCard, RoomMap, RouterLink],
  templateUrl: './search-page.html',
  styleUrl: './search-page.css',
})
export class SearchPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly catalog = inject(RoomService);
  private request = 0;
  protected readonly filters = signal(emptyFilters);
  protected readonly rooms = signal<readonly PublicRoom[]>([]);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly showMap = signal(false);

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => this.loadParams(params));
  }

  protected apply(filters: RoomFilters) {
    void this.router.navigate([], {
      relativeTo: this.route,
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

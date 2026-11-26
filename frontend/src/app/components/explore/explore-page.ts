import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { RoomFilters } from '../../interfaces/room';
import { RoomCard } from '../rooms/room-card';
import { RoomService } from '../../services/room.service';
import { SearchFilters } from '../rooms/search-filters';
import { UiIcon } from '../shared/ui-icon';
import { RevealOnScroll } from '../shared/reveal-on-scroll';

@Component({
  imports: [RouterLink, RoomCard, SearchFilters, UiIcon, RevealOnScroll],
  templateUrl: './explore-page.html',
  styleUrl: './explore-page.css',
})
export class ExplorePage {
  private readonly router = inject(Router);
  protected readonly catalog = inject(RoomService);
  protected readonly published = this.catalog.published();
  protected readonly recommended = computed(() => this.published.hasValue() ? this.published.value().slice(0, 3) : []);

  protected search(filters: RoomFilters) {
    void this.router.navigate(['/buscar'], {
      queryParams: {
        zona: filters.zone || null, universidad: filters.university || null, tipo: filters.type || null,
        precio: filters.maxPrice, minutos: filters.maxMinutes, distancia: filters.maxDistance, servicio: filters.amenities.length ? filters.amenities : null,
      },
    });
  }
}

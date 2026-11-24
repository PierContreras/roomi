import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { RoomFilters, zones } from '../../interfaces/room';
import { RoomCard } from '../rooms/room-card';
import { RoomService } from '../../services/room.service';
import { SessionService } from '../../services/session.service';
import { SearchFilters } from '../rooms/search-filters';
import { UiIcon } from '../shared/ui-icon';

@Component({
  imports: [RouterLink, RoomCard, SearchFilters, UiIcon],
  templateUrl: './explore-page.html',
  styleUrl: './explore-page.css',
})
export class ExplorePage {
  protected readonly zones = zones;
  protected readonly canAccessPublishing = computed(() => this.session.user()?.role !== 'admin');
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);
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

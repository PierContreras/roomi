import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { amenities, Amenity, RoomFilters, roomTypes, universities, zones } from '../../interfaces/room';
import { UiIcon } from '../shared/ui-icon';

export const emptyFilters: RoomFilters = {
  zone: '', university: '', type: '', maxPrice: null, maxMinutes: null, amenities: [],
};

@Component({
  selector: 'app-search-filters',
  imports: [FormsModule, UiIcon],
  templateUrl: './search-filters.html',
  styleUrl: './search-filters.css',
})
export class SearchFilters {
  readonly initial = input(emptyFilters);
  readonly applied = output<RoomFilters>();
  protected readonly zones = zones;
  protected readonly universities = universities;
  protected readonly types = roomTypes;
  protected readonly amenities = amenities;
  protected readonly wholeMinutes = /^\d+$/;
  protected readonly expanded = signal(false);
  protected draft: RoomFilters = { ...emptyFilters };

  ngOnChanges() {
    this.draft = { ...this.initial() };
  }

  protected toggleAmenity(amenity: Amenity, selected: boolean) {
    this.draft.amenities = selected
      ? [...this.draft.amenities, amenity]
      : this.draft.amenities.filter(item => item !== amenity);
  }

  protected reset() {
    this.draft = { ...emptyFilters };
    this.applied.emit(this.draft);
  }
}

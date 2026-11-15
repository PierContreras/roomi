import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RoomCard } from './room-card';
import { RoomService } from '../../services/room.service';

@Component({
  imports: [RouterLink, RoomCard],
  templateUrl: './saved-page.html',
})
export class SavedPage {
  protected readonly catalog = inject(RoomService);
  protected readonly published = this.catalog.published();
  protected readonly saved = computed(() => this.published.hasValue()
    ? this.published.value().filter(room => this.catalog.isSaved(room.id))
    : []);
}

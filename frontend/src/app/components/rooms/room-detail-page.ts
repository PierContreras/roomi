import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RoomGallery } from './room-gallery';
import { RoomMap } from './room-map';
import { RoomService } from '../../services/room.service';
import { roomNavigation } from './room-navigation';
import { UiIcon } from '../shared/ui-icon';

@Component({
  imports: [RouterLink, RoomGallery, RoomMap, UiIcon],
  templateUrl: './room-detail-page.html',
  styleUrl: './room-detail-page.css',
})
export class RoomDetailPage {
  readonly id = input.required<string>();
  protected readonly navigation = roomNavigation();
  protected readonly catalog = inject(RoomService);
  protected readonly room = this.catalog.detail(this.id);
}

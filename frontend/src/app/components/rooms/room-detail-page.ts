import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RoomGallery } from './room-gallery';
import { RoomMap } from './room-map';
import { RoomService } from '../../services/room.service';

@Component({
  imports: [RouterLink, RoomGallery, RoomMap],
  templateUrl: './room-detail-page.html',
})
export class RoomDetailPage {
  readonly id = input.required<string>();
  protected readonly catalog = inject(RoomService);
  protected readonly room = this.catalog.detail(this.id);
}

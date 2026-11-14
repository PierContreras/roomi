import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RoomCard } from './room-card';
import { RoomService } from '../../services/room.service';

@Component({
  imports: [RouterLink, RoomCard],
  templateUrl: './saved-page.html',
})
export class SavedPage {
  protected readonly catalog = inject(RoomService);
}

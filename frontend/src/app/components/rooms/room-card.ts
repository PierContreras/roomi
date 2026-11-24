import { Component, computed, input, output } from '@angular/core';
import { Params, RouterLink } from '@angular/router';
import { PublicRoom } from '../../interfaces/room';
import { UiIcon } from '../shared/ui-icon';
import { roomPhotos } from './room-photos';

@Component({
  selector: 'app-room-card',
  imports: [RouterLink, UiIcon],
  templateUrl: './room-card.html',
  styleUrl: './room-card.css',
})
export class RoomCard {
  readonly room = input.required<PublicRoom>();
  readonly saved = input.required<boolean>();
  readonly prioritizeCover = input(false);
  readonly detailQuery = input<Params>({});
  readonly saveToggled = output<string>();
  protected readonly cover = computed(() => roomPhotos(this.room())[0]);
}

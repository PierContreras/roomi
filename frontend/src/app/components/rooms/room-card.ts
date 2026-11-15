import { Component, input, output } from '@angular/core';
import { Params, RouterLink } from '@angular/router';
import { PublicRoom } from '../../interfaces/room';

@Component({
  selector: 'app-room-card',
  imports: [RouterLink],
  templateUrl: './room-card.html',
  styleUrl: './room-card.css',
})
export class RoomCard {
  readonly room = input.required<PublicRoom>();
  readonly saved = input.required<boolean>();
  readonly detailQuery = input<Params>({});
  readonly saveToggled = output<string>();
}

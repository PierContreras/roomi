import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Room } from '../../interfaces/room';

@Component({
  selector: 'app-room-card',
  imports: [RouterLink],
  templateUrl: './room-card.html',
  styleUrl: './room-card.css',
})
export class RoomCard {
  readonly room = input.required<Room>();
  readonly saved = input.required<boolean>();
  readonly saveToggled = output<string>();
}

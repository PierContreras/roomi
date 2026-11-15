import { Component, computed, input, model } from '@angular/core';
import { Params, RouterLink } from '@angular/router';
import { PublicRoom, Zone } from '../../interfaces/room';

const positions: Record<Zone, [number, number]> = {
  'El Tambo': [25, 23], 'San Carlos': [70, 34], 'Centro': [45, 56], 'Chilca': [63, 78],
};

@Component({
  selector: 'app-room-map',
  imports: [RouterLink],
  templateUrl: './room-map.html',
  styleUrl: './room-map.css',
})
export class RoomMap {
  readonly rooms = input.required<readonly PublicRoom[]>();
  readonly detailQuery = input<Params>({});
  readonly selected = model('');
  protected readonly markers = computed(() => Object.entries(positions).flatMap(([zone, [x, y]]) => {
    const rooms = this.rooms().filter(room => room.zone === zone);
    return rooms.length ? [{ zone, x, y, rooms }] : [];
  }));
  protected readonly active = computed(() => this.markers().find(marker => marker.zone === this.selected()));
}

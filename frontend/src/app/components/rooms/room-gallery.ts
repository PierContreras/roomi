import { Component, input, linkedSignal } from '@angular/core';
import { RoomPhoto } from '../../interfaces/room';

@Component({
  selector: 'app-room-gallery',
  templateUrl: './room-gallery.html',
  styles: ['img, .photo-placeholder { display: block; width: 100%; aspect-ratio: 2 / 1; min-height: 230px; object-fit: cover; border-radius: var(--radius); } .photo-placeholder { display: grid; } .actions { margin-top: .75rem; }'],
})
export class RoomGallery {
  readonly photos = input.required<readonly RoomPhoto[]>();
  protected readonly index = linkedSignal<number>(() => this.photos().length ? 0 : -1);
}

import { Component, input, linkedSignal } from '@angular/core';
import { RoomPhoto } from '../../interfaces/room';
import { UiIcon } from '../shared/ui-icon';

@Component({
  selector: 'app-room-gallery',
  imports: [UiIcon],
  templateUrl: './room-gallery.html',
  styles: [`
    img { display: block; width: 100%; aspect-ratio: 2 / 1; min-height: 175px; object-fit: cover; border-radius: var(--radius); }
    .controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-top: 10px; }
    .no-photo { display: flex; align-items: center; gap: 8px; margin: 0; padding: 14px; background: var(--soft); border-radius: 8px; }
    .controls button { padding-inline: 12px; }
  `],
})
export class RoomGallery {
  readonly photos = input.required<readonly RoomPhoto[]>();
  protected readonly index = linkedSignal<number>(() => this.photos().length ? 0 : -1);

  protected move(delta: number) {
    const count = this.photos().length;
    this.index.update(index => (index + delta + count) % count);
  }
}

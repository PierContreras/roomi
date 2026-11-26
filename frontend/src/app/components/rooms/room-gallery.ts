import { Component, input, linkedSignal } from '@angular/core';
import { RoomPhoto } from '../../interfaces/room';
import { UiIcon } from '../shared/ui-icon';

@Component({
  selector: 'app-room-gallery',
  imports: [UiIcon],
  templateUrl: './room-gallery.html',
  styles: [`
    .featured { display: block; width: 100%; aspect-ratio: 2 / 1; min-height: 175px; object-fit: cover; border-radius: var(--radius); }
    .photo-layout { display: grid; gap: var(--space-2); }
    .thumbnails { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .thumbnail { width: 80px; padding: 3px; border: 2px solid var(--border); border-radius: var(--radius-control); background: var(--white); }
    .thumbnail[aria-pressed="true"] { border-color: var(--brand); }
    .thumbnail img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 4px; }
    @media (min-width: 761px) {
      .photo-layout.with-thumbnails { grid-template-columns: minmax(0, 1fr) clamp(96px, 17vw, 200px); align-items: start; }
      .photo-layout.with-thumbnails .featured { max-height: 480px; }
      .thumbnails { display: grid; }
      .thumbnail { width: 100%; }
    }
    .controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-top: 10px; }
    .no-photo { display: flex; align-items: center; gap: 8px; margin: 0; padding: 14px; background: var(--soft); border-radius: 8px; }
    .controls button { padding-inline: 12px; }
  `],
})
export class RoomGallery {
  readonly photos = input.required<readonly RoomPhoto[]>();
  readonly thumbnails = input(false);
  protected readonly index = linkedSignal<number>(() => this.photos().length ? 0 : -1);

  protected move(delta: number) {
    const count = this.photos().length;
    this.index.update(index => (index + delta + count) % count);
  }

  protected select(position: number) {
    this.index.set(position);
  }
}

import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { Params, RouterLink } from '@angular/router';
import { PublicRoom } from '../../interfaces/room';
import { amenityIcons, UiIcon } from '../shared/ui-icon';
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
  protected readonly amenityIcons = amenityIcons;
  protected readonly photos = computed(() => roomPhotos(this.room()));
  protected readonly activePhoto = linkedSignal({ source: this.photos, computation: () => 0 });
  protected readonly cover = computed(() => this.photos()[this.activePhoto()]);

  protected changePhoto(step: number) {
    const count = this.photos().length;
    if (count > 1) this.activePhoto.update(index => (index + step + count) % count);
  }
}

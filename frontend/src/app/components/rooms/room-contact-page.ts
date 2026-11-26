import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RoomService } from '../../services/room.service';
import { roomNavigation } from './room-navigation';
import { whatsappUrl } from './room-contact';
import { UiIcon } from '../shared/ui-icon';

@Component({
  imports: [RouterLink, UiIcon],
  templateUrl: './room-contact-page.html',
})
export class RoomContactPage {
  readonly id = input.required<string>();
  protected readonly navigation = roomNavigation();
  private readonly catalog = inject(RoomService);
  protected readonly room = this.catalog.detail(this.id);
  protected readonly contact = this.catalog.contact(this.id);
  protected readonly whatsappUrl = whatsappUrl;
}

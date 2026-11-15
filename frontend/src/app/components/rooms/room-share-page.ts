import { Component, computed, DOCUMENT, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { RoomService } from '../../services/room.service';
import { roomNavigation } from './room-navigation';
import { UiLibraries } from '../../services/ui-libraries';
import { copyToClipboard } from '../shared/copy-to-clipboard';
import { UiIcon } from '../shared/ui-icon';

@Component({
  imports: [RouterLink, UiIcon],
  templateUrl: './room-share-page.html',
  styleUrl: './room-share-page.css',
})
export class RoomSharePage {
  readonly id = input.required<string>();
  protected readonly navigation = roomNavigation();
  private readonly catalog = inject(RoomService);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly libraries = inject(UiLibraries);
  protected readonly room = this.catalog.detail(this.id);
  protected readonly feedback = signal<'idle' | 'copied' | 'manual'>('idle');
  protected readonly link = computed(() => {
    const path = this.router.serializeUrl(this.router.createUrlTree(['/habitaciones', this.id()]));
    return new URL(path, this.document.baseURI).href;
  });

  protected async copy(field: HTMLInputElement) {
    const copied = await copyToClipboard(field);
    this.feedback.set(copied ? 'copied' : 'manual');
    if (copied) void this.libraries.success('Enlace copiado');
  }
}

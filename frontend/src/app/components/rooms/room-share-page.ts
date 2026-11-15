import { Component, computed, DOCUMENT, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { RoomService } from '../../services/room.service';
import { roomNavigation } from './room-navigation';
import { UiLibraries } from '../../services/ui-libraries';

@Component({
  imports: [RouterLink],
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
    try {
      const clipboard = this.document.defaultView?.navigator.clipboard;
      if (!clipboard) throw new Error('Clipboard unavailable');
      await clipboard.writeText(this.link());
      this.feedback.set('copied');
      void this.libraries.success('Enlace copiado');
    } catch {
      field.focus();
      field.select();
      this.feedback.set('manual');
    }
  }
}

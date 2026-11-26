import { afterNextRender, Component, computed, DOCUMENT, ElementRef, inject, Injector, input, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { ListingResult, RoomDraft } from '../../interfaces/room';
import { RoomGallery } from '../rooms/room-gallery';
import { publicationError, RoomService } from '../../services/room.service';
import { StatusBadge } from '../shared/status-badge';
import { SessionService } from '../../services/session.service';
import { RoomForm } from './room-form';

const unavailableListing = 'No encontramos este anuncio en tu cuenta.';

@Component({
  imports: [RouterLink, RoomForm, RoomGallery, StatusBadge],
  templateUrl: './room-editor-page.html',
  styles: [`
    .editor { max-width: 880px; }
    .editor-toolbar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; }
    .editor-brand { color: var(--brand); font: 750 1.8rem/1 var(--heading); text-decoration: none; }
    .editor-intro h1 { margin: 0; font-size: clamp(1.45rem, 3vw, 2rem); }
    .preview-heading:focus { outline: none; }
    .preview-listing { padding: var(--space-3); background: var(--mint-surface); border-radius: var(--radius-control); overflow-wrap: anywhere; }
    .preview-price strong { color: var(--brand); font-size: 1.2em; }
    .preview-facts { display: grid; gap: var(--space-2); margin: 0; overflow-wrap: anywhere; }
    .preview-facts div { border-top: 1px solid var(--border); padding-top: var(--space-2); }
    .preview-facts dt { font-weight: 700; }
    .preview-facts dd { margin: 2px 0 0; color: var(--muted); }
    .preview-actions { justify-content: flex-end; border-top: 1px solid var(--border); padding-top: var(--space-3); }
    .publication-result { text-align: center; padding-block: clamp(28px, 7vw, 68px); }
    .publication-result .actions { justify-content: center; }
    @media (prefers-reduced-motion: no-preference) {
      .publication-preview, .publication-result { animation: publication-enter 260ms ease-out both; }
      @keyframes publication-enter { from { opacity: .45; translate: 12px 0; } }
    }
  `],
})
export class RoomEditorPage {
  readonly id = input<string>();
  private readonly catalog = inject(RoomService);
  private readonly session = inject(SessionService);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly previewHeading = viewChild<ElementRef<HTMLElement>>('previewHeading');
  private readonly resultHeading = viewChild<ElementRef<HTMLElement>>('resultHeading');
  protected readonly progressKey = computed(() => {
    const account = this.session.user();
    return !this.id() && account ? `roomi.publication.${account.id}` : undefined;
  });
  protected readonly managed = this.catalog.managed();
  protected readonly unavailableListing = unavailableListing;
  protected readonly loadError = computed(() =>
    this.editError(this.managed.error(), 'No pudimos cargar el anuncio. Intenta de nuevo o vuelve a Mis anuncios.'));
  protected readonly existing = computed(() => {
    const id = this.id();
    return id && this.managed.hasValue()
      ? this.managed.value().find(room => room.id === id)
      : undefined;
  });
  protected readonly draft = signal<RoomDraft | undefined>(undefined);
  protected readonly preview = signal(false);
  protected readonly saved = signal<(ListingResult & { title: string }) | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly checkPhoto = signal(false);
  protected readonly formStep = signal(0);

  protected review(draft: RoomDraft) {
    this.draft.set(draft);
    this.checkPhoto.set(false);
    this.error.set('');
    this.preview.set(true);
    afterNextRender(() => this.focusScreen(this.previewHeading()?.nativeElement), { injector: this.injector });
  }

  protected editStep(step: number) {
    this.formStep.set(step);
    this.preview.set(false);
  }

  protected async publish(draft: RoomDraft, borrador = false) {
    if (this.busy()) return;
    this.error.set('');
    const status = this.existing()?.status;
    if (!borrador && (status === undefined || status === 'publicado') && !draft.photos.length) {
      this.checkPhoto.set(true);
      this.editStep(2);
      return;
    }
    this.busy.set(true);
    try {
      const result = await this.catalog.save(draft, this.id(), borrador);
      this.saved.set({ ...result, title: draft.title });
      afterNextRender(() => this.focusScreen(this.resultHeading()?.nativeElement), { injector: this.injector });
      const key = this.progressKey();
      try {
        if (key) this.document.defaultView?.sessionStorage.removeItem(key);
      } catch {
        // El anuncio ya se guardó en el servidor.
      }
    } catch (error) {
      this.error.set(this.editError(error, 'No pudimos guardar. Revisa los datos y vuelve a intentar.'));
    } finally {
      this.busy.set(false);
    }
  }

  private editError(error: unknown, fallback: string) {
    if (this.id() && error instanceof HttpErrorResponse && error.status === 404) return unavailableListing;
    return publicationError(error, fallback);
  }

  private focusScreen(heading?: HTMLElement) {
    heading?.focus({ preventScroll: true });
    heading?.closest('.editor')?.scrollIntoView?.({ block: 'start', behavior: 'instant' });
  }
}

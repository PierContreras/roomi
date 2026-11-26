import { Component, ElementRef, computed, effect, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RoomCard } from './room-card';
import { RoomService } from '../../services/room.service';
import { UiIcon } from '../shared/ui-icon';
import { RevealOnScroll } from '../shared/reveal-on-scroll';

@Component({
  imports: [RouterLink, RoomCard, UiIcon, RevealOnScroll],
  templateUrl: './saved-page.html',
  styleUrl: './saved-page.css',
})
export class SavedPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  private readonly comparisonPanel = viewChild<ElementRef<HTMLElement>>('comparisonPanel');
  private scrollToComparison = false;
  protected readonly catalog = inject(RoomService);
  protected readonly published = this.catalog.published();
  protected readonly saved = computed(() => this.published.hasValue()
    ? this.published.value().filter(room => this.catalog.isSaved(room.id))
    : []);
  protected readonly showComparison = computed(() => this.params().getAll('comparar').length === 2);
  protected readonly pair = computed((): readonly [string, string] => {
    const [left, right] = this.params().getAll('comparar');
    const rooms = this.saved();
    const first = rooms.find(room => room.id === left)?.id ?? rooms[0]?.id ?? '';
    const others = rooms.filter(room => room.id !== first);
    const second = others.find(room => room.id === right)?.id ?? others[0]?.id ?? '';
    return [first, second];
  });
  protected readonly comparison = computed(() => this.pair().flatMap(id => this.saved().filter(room => room.id === id)));
  protected readonly detailQuery = computed(() => ({
    origen: 'guardados',
    comparar: this.showComparison() && this.comparison().length === 2 ? this.pair() : null,
  }));

  constructor() {
    effect(() => {
      const panel = this.comparisonPanel()?.nativeElement;
      if (!panel || !this.scrollToComparison) return;
      this.scrollToComparison = false;
      const motion = panel.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: no-preference)').matches;
      panel.scrollIntoView?.({ block: 'start', behavior: motion ? 'smooth' : 'instant' });
    });
  }

  protected toggleComparison() {
    this.scrollToComparison = !this.showComparison();
    this.setComparison(this.showComparison() ? null : this.pair());
  }

  protected selectRoom(side: 0 | 1, id: string) {
    const [first, second] = this.pair();
    this.setComparison(side === 0 ? [id, second] : [first, id]);
  }

  private setComparison(pair: readonly [string, string] | null) {
    void this.router.navigate([], {
      relativeTo: this.route, queryParams: { comparar: pair }, queryParamsHandling: 'merge', replaceUrl: true, scroll: 'manual',
    });
  }
}

import { isPlatformBrowser, ViewportScroller } from '@angular/common';
import { Component, DestroyRef, DOCUMENT, ElementRef, PLATFORM_ID, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet, Scroll } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SiteFooter } from './components/shared/site-footer';
import { SiteHeader } from './components/shared/site-header';

@Component({
  imports: [RouterOutlet, SiteHeader, SiteFooter],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly viewport = inject(ViewportScroller);
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');
  protected readonly editorMode = signal(false);

  constructor() {
    const browser = isPlatformBrowser(inject(PLATFORM_ID));
    let previousPath: string | undefined;
    let previousFragment: string | null = null;
    let scrollNavigationId = 0;
    let shouldScroll = false;
    let pendingHeading: MutationObserver | undefined;
    let pendingAnchor: MutationObserver | undefined;
    inject(DestroyRef).onDestroy(() => {
      pendingHeading?.disconnect();
      pendingAnchor?.disconnect();
    });
    if (browser) this.viewport.setHistoryScrollRestoration('manual');

    this.router.events.pipe(takeUntilDestroyed()).subscribe(event => {
      if (browser && event instanceof Scroll) {
        if (event.scrollBehavior === 'manual' || event.routerEvent.id < scrollNavigationId) return;
        if (event.position) {
          this.restorePosition(event.position);
        } else if (event.anchor && (shouldScroll || !(event.routerEvent instanceof NavigationEnd))) {
          pendingAnchor?.disconnect();
          if (this.centerAnchor(event.anchor)) return;
          const Observer = this.document.defaultView?.MutationObserver;
          if (Observer) {
            const anchor = event.anchor;
            pendingAnchor = new Observer(() => {
              if (this.centerAnchor(anchor)) pendingAnchor?.disconnect();
            });
            pendingAnchor.observe(this.main().nativeElement, { childList: true, subtree: true });
          }
        } else if (!event.anchor && shouldScroll && event.routerEvent instanceof NavigationEnd) {
          this.restorePosition([0, 0]);
        }
        return;
      }
      if (!(event instanceof NavigationEnd)) return;
      const url = this.router.parseUrl(event.urlAfterRedirects);
      const path = event.urlAfterRedirects.split(/[?#]/)[0];
      let route = this.router.routerState.snapshot.root;
      while (route.firstChild) route = route.firstChild;
      this.editorMode.set(route.data['editorMode'] === true);

      const changedPage = previousPath !== undefined && previousPath !== path;
      shouldScroll = previousPath !== path || previousFragment !== url.fragment;
      scrollNavigationId = event.id;
      previousFragment = url.fragment;
      previousPath = path;
      if (shouldScroll) pendingAnchor?.disconnect();
      if (!browser || !changedPage) return;
      pendingHeading?.disconnect();
      queueMicrotask(() => {
        if (this.router.url.split(/[?#]/)[0] !== path) return;
        const main = this.main().nativeElement;
        if (!this.editorMode() && this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: no-preference)').matches) {
          main.querySelector('router-outlet + *')?.animate?.(
            [{ opacity: 0.7, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }],
            { duration: 180, easing: 'ease-out' },
          );
        }
        if (url.fragment) return;
        const focusHeading = () => {
          const heading = main.querySelector('h1');
          if (!heading) return false;
          heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
          return true;
        };
        if (focusHeading()) return;
        main.focus({ preventScroll: true });
        const Observer = this.document.defaultView?.MutationObserver;
        if (!Observer) return;
        pendingHeading = new Observer(() => {
          if (this.document.activeElement !== main || focusHeading()) pendingHeading?.disconnect();
        });
        pendingHeading.observe(main, { childList: true, subtree: true });
      });
    });
  }

  private centerAnchor(id: string) {
    const anchor = this.document.getElementById(id);
    if (!anchor || !this.main().nativeElement.contains(anchor)) return false;

    if (anchor instanceof HTMLDetailsElement) anchor.open = true;
    const target = anchor.querySelector<HTMLElement>('summary, h1, h2, h3') ?? anchor;
    if (target.localName !== 'summary' && !target.hasAttribute('tabindex')) target.tabIndex = -1;
    target.focus({ preventScroll: true });
    const motion = this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: no-preference)').matches;
    target.scrollIntoView?.({ block: 'center', behavior: motion ? 'smooth' : 'instant' });
    return true;
  }

  private restorePosition(position: [number, number]) {
    const [x, y] = this.viewport.getScrollPosition();
    if (x !== position[0] || y !== position[1]) {
      this.viewport.scrollToPosition(position, { behavior: 'instant' });
    }
  }
}

import { DOCUMENT, Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { SessionService } from '../../services/session.service';
import { UiIcon } from './ui-icon';

@Component({
  selector: 'app-site-header',
  imports: [NgTemplateOutlet, RouterLink, RouterLinkActive, UiIcon],
  templateUrl: './site-header.html',
  styleUrl: './site-header.css',
})
export class SiteHeader {
  protected readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly drawer = viewChild.required<ElementRef<HTMLDialogElement>>('drawer');
  private readonly menuButton = viewChild.required<ElementRef<HTMLButtonElement>>('menuButton');
  private readonly brand = viewChild.required<ElementRef<HTMLAnchorElement>>('brand');
  protected readonly menuOpen = signal(false);
  protected readonly path = signal(this.router.url.split(/[?#]/)[0]);

  constructor() {
    this.router.events.pipe(filter(event => event instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(event => {
        this.path.set(event.urlAfterRedirects.split(/[?#]/)[0]);
        this.closeMenu();
      });

    const mobile = inject(DOCUMENT).defaultView?.matchMedia?.('(max-width: 940px)');
    if (mobile) {
      const onResize = (event: MediaQueryListEvent) => {
        if (event.matches || !this.menuOpen()) return;
        this.closeMenu();
        this.brand().nativeElement.focus();
      };
      mobile.addEventListener('change', onResize);
      inject(DestroyRef).onDestroy(() => mobile.removeEventListener('change', onResize));
    }
  }

  protected openMenu() {
    if (this.menuOpen()) return;
    const drawer = this.drawer().nativeElement;
    this.menuButton().nativeElement.focus({ preventScroll: true });
    drawer.showModal();
    this.menuOpen.set(true);
    drawer.querySelector('button')?.focus();
  }

  protected closeMenu() {
    if (!this.menuOpen()) return;
    this.drawer().nativeElement.close();
    this.menuOpen.set(false);
    this.menuButton().nativeElement.focus({ preventScroll: true });
  }

  protected cancelMenu(event: Event) {
    event.preventDefault();
    this.closeMenu();
  }

  protected dismissBackdrop(event: MouseEvent) {
    const drawer = this.drawer().nativeElement;
    if (event.target !== drawer) return;
    const bounds = drawer.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX >= bounds.right ||
        event.clientY < bounds.top || event.clientY >= bounds.bottom) this.closeMenu();
  }

  protected keepFocus(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const drawer = this.drawer().nativeElement;
    const controls = [...drawer.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), summary')]
      .filter(control => control.tagName === 'SUMMARY' || !control.closest('details:not([open])'));
    const first = controls[0];
    const last = controls[controls.length - 1];
    const active = drawer.ownerDocument.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  protected closeAccountOnBlur(account: HTMLDetailsElement, event: FocusEvent) {
    if (event.relatedTarget instanceof Node && account.contains(event.relatedTarget)) return;
    account.open = false;
  }

  protected closeAccountOnEscape(account: HTMLDetailsElement, event: Event) {
    if (!account.open) return;
    event.preventDefault();
    event.stopPropagation();
    account.open = false;
    account.querySelector('summary')?.focus();
  }

  protected signOut() {
    this.session.signOut();
    this.closeMenu();
    void this.router.navigateByUrl('/explorar');
  }
}

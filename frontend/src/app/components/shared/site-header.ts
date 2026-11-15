import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { SessionService } from '../../services/session.service';

@Component({
  selector: 'app-site-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './site-header.html',
  styleUrl: './site-header.css',
})
export class SiteHeader {
  protected readonly session = inject(SessionService);
  private readonly router = inject(Router);
  protected readonly menuOpen = signal(false);
  protected readonly path = signal(this.router.url.split(/[?#]/)[0]);

  constructor() {
    this.router.events.pipe(filter(event => event instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(event => {
        this.path.set(event.urlAfterRedirects.split(/[?#]/)[0]);
        this.menuOpen.set(false);
      });
  }

  protected closeMenu(button: HTMLButtonElement) {
    if (!this.menuOpen()) return;
    this.menuOpen.set(false);
    button.focus();
  }

  protected signOut() {
    this.session.signOut();
    this.menuOpen.set(false);
    void this.router.navigateByUrl('/explorar');
  }
}

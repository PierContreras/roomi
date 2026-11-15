import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
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
  protected closeMenu(button: HTMLButtonElement) {
    if (!this.menuOpen()) return;
    this.menuOpen.set(false);
    button.focus();
  }

  protected signOut() {
    this.session.signOut();
    this.menuOpen.set(false);
    void this.router.navigateByUrl('/acceso');
  }
}

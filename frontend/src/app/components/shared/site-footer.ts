import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-site-footer',
  imports: [RouterLink],
  templateUrl: './site-footer.html',
  styles: ['footer { background: white; border-top: 1px solid var(--border); padding-block: 2rem; color: var(--muted); font-size: .8125rem; } a { color: var(--brand); } .brand { font-size: 1.5rem; font-weight: 700; text-decoration: none; }'],
})
export class SiteFooter {}

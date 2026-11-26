import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { zones } from '../../interfaces/room';
import { UiIcon } from './ui-icon';

@Component({
  selector: 'app-site-footer',
  imports: [RouterLink, UiIcon],
  templateUrl: './site-footer.html',
  styleUrl: './site-footer.css',
})
export class SiteFooter {
  protected readonly zones = zones;
}

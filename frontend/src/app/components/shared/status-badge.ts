import { Component, input } from '@angular/core';
import { RoomStatus, statusLabels } from '../../interfaces/room';

@Component({
  selector: 'app-status-badge',
  template: '<span [class]="status()">{{ labels[status()] }}</span>',
  styles: ['span { display: inline-block; border-radius: 16px; padding: 4px 10px; font-size: .8125rem; font-weight: 650; background: var(--blue-surface); color: var(--ink); } .publicado { background: var(--mint-surface); color: var(--success); }'],
})
export class StatusBadge {
  readonly status = input.required<RoomStatus>();
  protected readonly labels = statusLabels;
}

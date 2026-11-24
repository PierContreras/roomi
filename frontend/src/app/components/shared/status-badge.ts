import { Component, input } from '@angular/core';
import { RoomStatus, statusLabels } from '../../interfaces/room';

@Component({
  selector: 'app-status-badge',
  template: '<span [class]="status()">{{ labels[status()] }}</span>',
  styles: ['span { display: inline-block; border-radius: 16px; padding: 4px 10px; font-size: .8125rem; font-weight: 650; background: #e8edf1; color: var(--ink); } .en_revision { background: #fff0d2; color: #694900; } .publicado { background: #d9f0e5; color: #16573e; } .rechazado { background: #fde5e8; color: #8d2837; }'],
})
export class StatusBadge {
  readonly status = input.required<RoomStatus>();
  protected readonly labels = statusLabels;
}

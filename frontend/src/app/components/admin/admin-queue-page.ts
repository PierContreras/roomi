import { moderationReasonLabels } from '../../interfaces/room';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RoomService } from '../../services/room.service';
import { StatusBadge } from '../shared/status-badge';

@Component({
  imports: [RouterLink, StatusBadge],
  templateUrl: './admin-queue-page.html',
})
export class AdminQueuePage {
  private readonly catalog = inject(RoomService);
  protected readonly managed = this.catalog.managed('administracion');
  protected readonly reports = this.catalog.reports();
  private readonly rooms = computed(() => this.managed.hasValue() ? this.managed.value() : []);
  protected readonly pending = computed(() => this.rooms().filter(room => room.status === 'en_revision'));
  protected readonly reasons = moderationReasonLabels;
}

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
  protected readonly pending = computed(() => this.catalog.rooms().filter(room => room.status === 'pending'));
  protected readonly reviewed = computed(() => this.catalog.rooms().filter(room => room.status === 'approved' || room.status === 'rejected'));
}

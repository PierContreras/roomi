import { Component, ElementRef, input, output, viewChild } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.html',
  styles: ['dialog { width: min(480px, calc(100% - 32px)); padding: 24px; border: 1px solid var(--border); border-radius: var(--radius); color: var(--ink); } dialog::backdrop { background: rgb(0 25 31 / .52); }'],
})
export class ConfirmDialog {
  readonly heading = input.required<string>();
  readonly approve = input('Confirmar');
  readonly danger = input(false);
  readonly accepted = output();
  readonly closed = output();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  open() {
    this.dialog().nativeElement.showModal();
  }

  protected close(confirmed = false) {
    if (confirmed) this.accepted.emit();
    this.dialog().nativeElement.close();
  }
}

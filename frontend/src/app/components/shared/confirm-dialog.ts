import { Component, ElementRef, input, output, viewChild } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.html',
  styles: [`
    dialog::backdrop { background: rgb(16 43 45 / .56); }
    .confirm-icon {
      display: grid;
      width: 56px;
      height: 56px;
      margin: 0 auto 16px;
      place-items: center;
      border: 2px solid currentColor;
      border-radius: 50%;
      background: #fff5df;
      color: #805512;
      font: 700 2rem / 1 var(--heading);
    }
    .confirm-icon.danger { background: #fff0f2; color: var(--error); }
  `],
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

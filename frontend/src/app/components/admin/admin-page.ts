import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminRecord, AdminSection, AdminService } from '../../services/admin.service';
import { apiError } from '../../services/session.service';

const sections = [
  { key: 'usuarios', label: 'Usuarios', columns: [['nombre', 'Nombre'], ['correo', 'Correo'], ['rol', 'Rol'], ['anuncios', 'Anuncios']], details: [] },
  { key: 'anuncios', label: 'Anuncios', columns: [['titulo', 'Anuncio'], ['titular', 'Titular'], ['zona', 'Zona'], ['precio', 'Precio (S/)'], ['estado', 'Estado']], details: [
    ['universidad', 'Universidad'], ['tipo', 'Tipo'], ['direccion', 'Dirección'], ['garantia', 'Garantía (S/)'], ['fotos', 'Fotos'], ['descripcion', 'Descripción'], ['reglas', 'Reglas'],
  ] },
  { key: 'reportes', label: 'Reportes', columns: [['anuncio', 'Anuncio'], ['autor', 'Autor'], ['estado', 'Estado'], ['fecha', 'Fecha']], details: [
    ['mensaje', 'Motivo del reporte'], ['fechaResolucion', 'Fecha de resolución'],
  ] },
  { key: 'resenas', label: 'Reseñas', columns: [['anuncio', 'Anuncio'], ['autor', 'Autor'], ['calificacion', 'Nota / 5'], ['fecha', 'Fecha']], details: [
    ['mensaje', 'Reseña'],
  ] },
  { key: 'consultas', label: 'Consultas', columns: [['anuncio', 'Anuncio'], ['autor', 'Contacto'], ['estado', 'Estado'], ['fecha', 'Fecha']], details: [
    ['correo', 'Correo'], ['whatsapp', 'WhatsApp'], ['mensaje', 'Consulta'], ['fechaRespuesta', 'Fecha de respuesta'],
  ] },
  { key: 'moderacion', label: 'Historial de moderación', columns: [['anuncio', 'Anuncio'], ['accion', 'Acción'], ['responsable', 'Responsable'], ['fecha', 'Fecha']], details: [
    ['motivo', 'Motivo'],
  ] },
] as const;

@Component({
  imports: [DatePipe, RouterLink],
  templateUrl: './admin-page.html',
  styleUrl: './admin-page.css',
})
export class AdminPage {
  private readonly admin = inject(AdminService);
  protected readonly summary = this.admin.summary();
  protected readonly sections = sections;
  protected readonly section = signal<AdminSection>('usuarios');
  protected readonly active = computed(() => sections.find(item => item.key === this.section()) ?? sections[0]);
  protected readonly search = signal('');
  protected readonly draftSearch = signal('');
  protected readonly page = signal(1);
  protected readonly selected = signal<AdminRecord | null>(null);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal('');
  protected readonly feedback = signal('');
  protected readonly results = this.admin.list(computed(() => ({
    section: this.section(), search: this.search(), page: this.page(),
  })));

  protected select(section: AdminSection) {
    if (this.section() === section) return;
    this.section.set(section);
    this.search.set('');
    this.draftSearch.set('');
    this.changePage(1);
  }

  protected applySearch(value: string, event: Event) {
    event.preventDefault();
    this.search.set(value.trim());
    this.changePage(1);
  }

  protected changePage(page: number) {
    this.page.set(page);
    this.selected.set(null);
  }

  protected openDelete(dialog: HTMLDialogElement, form: HTMLFormElement) {
    form.reset();
    this.deleteError.set('');
    this.feedback.set('');
    dialog.showModal();
  }

  protected async deleteListing(reason: string, dialog: HTMLDialogElement, event: Event) {
    event.preventDefault();
    const record = this.selected();
    if (!record || this.deleting()) return;
    if (reason.trim().length < 3) {
      this.deleteError.set('Ingresa un motivo de al menos 3 caracteres.');
      return;
    }
    this.deleteError.set('');
    this.deleting.set(true);
    try {
      await this.admin.deleteListing(record.id, reason.trim());
      dialog.close();
      this.selected.set(null);
      this.feedback.set('Anuncio eliminado del catálogo. La decisión se guardó en el historial.');
      this.results.reload();
      this.summary.reload();
    } catch (error) {
      this.deleteError.set(apiError(error, 'No pudimos eliminar el anuncio. Inténtalo de nuevo.'));
    } finally {
      this.deleting.set(false);
    }
  }
}

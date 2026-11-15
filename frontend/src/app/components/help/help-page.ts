import { Component, computed, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';

const topics = [
  { title: 'Cómo buscar habitación', description: 'Usa filtros por campus, zona, distancia y presupuesto para acotar tu búsqueda.', label: 'Ver habitaciones', route: '/buscar' },
  { title: 'Contacto directo', description: 'Consulta por la visita, los servicios incluidos y las normas de convivencia.', label: 'Guía de contacto', fragment: 'contacto' },
  { title: 'Publicar una habitación', description: 'Describe el alojamiento e incluye el precio, los servicios y las condiciones de alquiler.', label: 'Cómo publicar', fragment: 'publicacion' },
  { title: 'Seguridad y prevención', description: 'Verifica el anuncio, la habitación y las condiciones antes de acordar el alquiler.', label: 'Consejos de seguridad', fragment: 'seguridad' },
];

const questions = [
  { id: 'pagos', title: '¿ROOMI gestiona pagos o reservas?', answer: 'ROOMI es un directorio de habitaciones. Las visitas, los acuerdos de alquiler y los pagos se coordinan directamente con el propietario.' },
  { id: 'contacto', title: '¿Cómo puedo contactar al propietario?', answer: 'Abre la ficha de la habitación y selecciona Contactar al propietario. En este prototipo se prepara un mensaje de ejemplo. Puedes incluir la fecha que te interesa o preguntar qué servicios cubre el precio.' },
  { id: 'seguridad', title: '¿Qué debo verificar antes de alquilar?', answer: 'Visita la habitación, confirma la identidad del propietario y solicita por escrito el precio, la garantía y los servicios incluidos antes de acordar un pago.' },
  { id: 'campus', title: '¿Cómo encuentro habitaciones cerca de mi universidad?', answer: 'En Buscar, elige tu universidad y revisa el tiempo aproximado al campus de cada anuncio. Puedes combinar el filtro con zona, precio y servicios.' },
  { id: 'publicacion', title: '¿Cómo publico una habitación?', answer: 'Entra con el perfil Propietario, completa la ficha y envíala a revisión. Puedes seguir el estado desde Mis anuncios.' },
];

function normalize(text: string) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

@Component({
  imports: [FormsModule, RouterLink],
  templateUrl: './help-page.html',
  styleUrl: './help-page.css',
})
export class HelpPage {
  protected readonly topics = topics;
  protected readonly query = signal('');
  protected searchText = '';
  protected readonly filtered = computed(() => questions.filter(question =>
    normalize(question.title + ' ' + question.answer).includes(normalize(this.query())),
  ));
  protected readonly confirmation = signal(false);
  protected readonly submitted = signal(false);
  protected inquiry = { name: '', email: '', subject: '', message: '' };

  protected clearSearch() {
    this.searchText = '';
    this.query.set('');
  }

  protected submit(form: NgForm) {
    this.submitted.set(true);
    if (form.invalid || !this.inquiry.name.trim() || this.inquiry.message.trim().length < 10) {
      form.control.markAllAsTouched();
      return;
    }
    this.confirmation.set(true);
    this.inquiry = { name: '', email: '', subject: '', message: '' };
    this.submitted.set(false);
  }
}

import { Component, ElementRef, Injector, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { UiIcon } from '../shared/ui-icon';
import { RevealOnScroll } from '../shared/reveal-on-scroll';

const topics: readonly { icon: 'search' | 'message' | 'plus' | 'help'; title: string; description: string; label: string; route?: string; fragment?: string }[] = [
  { icon: 'search', title: 'Cómo buscar habitación', description: 'Usa filtros por campus, zona, distancia y presupuesto para acotar tu búsqueda.', label: 'Ver habitaciones', route: '/buscar' },
  { icon: 'message', title: 'Contacto directo', description: 'Consulta por la visita, los servicios incluidos y las normas de convivencia.', label: 'Guía de contacto', fragment: 'contacto' },
  { icon: 'plus', title: 'Publicar una habitación', description: 'Describe el alojamiento e incluye el precio, los servicios y las condiciones de alquiler.', label: 'Cómo publicar', fragment: 'publicacion' },
  { icon: 'help', title: 'Seguridad y prevención', description: 'Verifica el anuncio, la habitación y las condiciones antes de acordar el alquiler.', label: 'Consejos de seguridad', fragment: 'seguridad' },
];

const questions = [
  { id: 'pagos', title: '¿ROOMI gestiona pagos o reservas?', answer: 'ROOMI es un directorio de habitaciones. Las visitas, los acuerdos de alquiler y los pagos se coordinan directamente con el propietario.' },
  { id: 'contacto', title: '¿Cómo puedo contactar al propietario?', answer: 'En la ficha, selecciona Contactar propietario. WhatsApp abrirá un mensaje con el nombre del anuncio para que lo edites y lo envíes. Puedes consultar la disponibilidad o coordinar una visita en ese chat.' },
  { id: 'seguridad', title: '¿Qué debo verificar antes de alquilar?', answer: 'Visita la habitación, confirma la identidad del propietario y solicita por escrito el precio, la garantía y los servicios incluidos antes de acordar un pago.' },
  { id: 'campus', title: '¿Cómo encuentro habitaciones cerca de mi universidad?', answer: 'En Buscar, elige tu universidad y revisa el tiempo aproximado al campus de cada anuncio. Puedes combinar el filtro con zona, precio y servicios.' },
  { id: 'publicacion', title: '¿Cómo publico una habitación?', answer: 'Inicia sesión, completa la ficha y confirma la publicación. Tu anuncio aparecerá en el catálogo y podrás gestionarlo desde Mis anuncios.' },
];

function normalize(text: string) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

@Component({
  imports: [FormsModule, RouterLink, UiIcon, RevealOnScroll],
  templateUrl: './help-page.html',
  styleUrl: './help-page.css',
})
export class HelpPage {
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly route = inject(ActivatedRoute);
  private readonly supportHeading = viewChild<ElementRef<HTMLElement>>('supportHeading');
  protected readonly topics = topics;
  protected readonly fragment = toSignal(this.route.fragment);
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

  protected searchQuestions() {
    this.query.set(this.searchText.trim());
    this.centerSection('preguntas');
  }

  private centerSection(fragment: string) {
    afterNextRender(() => {
      const host = this.host.nativeElement;
      const target = host.ownerDocument.getElementById(fragment);
      if (!target || !host.contains(target)) return;
      const summary = target.querySelector('summary');
      if (target instanceof HTMLDetailsElement) target.open = true;
      const heading = summary ?? target;
      heading.focus({ preventScroll: true });
      const motion = host.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: no-preference)').matches;
      heading.scrollIntoView?.({ block: 'center', behavior: motion ? 'smooth' : 'instant' });
    }, { injector: this.injector });
  }

  protected resetConfirmation() {
    this.confirmation.set(false);
    this.focusSupport();
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
    this.focusSupport();
  }

  private focusSupport() {
    afterNextRender(() => this.supportHeading()?.nativeElement.focus(), { injector: this.injector });
  }
}

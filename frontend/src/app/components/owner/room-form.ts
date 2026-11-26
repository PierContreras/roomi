import { afterNextRender, Component, DOCUMENT, ElementRef, inject, Injector, input, output, signal, viewChild } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { amenityIcons, UiIcon } from '../shared/ui-icon';
import { amenities, Amenity, RoomDraft, RoomPhoto, roomTypes, universities, zones } from '../../interfaces/room';
import { normalizeWhatsapp } from '../rooms/room-contact';
import { isHuancayoPoint, MapPoint, zonePoints } from '../rooms/room-location';
import { RoomLocationPicker } from './room-location-picker';

const maxPhotoBytes = 400_000;

async function resizePhoto(file: File): Promise<Blob> {
  if (file.size <= maxPhotoBytes) return file;
  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('No se pudo preparar la imagen.');
    for (const maxSide of [1600, 1200, 800]) {
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const compressed = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.75));
      if (compressed && compressed.size <= maxPhotoBytes) return compressed;
    }
    throw new Error('La imagen es demasiado grande.');
  } finally {
    image.close();
  }
}

interface RoomFields extends Omit<RoomDraft, 'price' | 'deposit' | 'minutes'> {
  price: number | null;
  deposit: number | null;
  minutes: number | null;
}

const emptyRoom: RoomFields = {
  title: '', zone: 'San Carlos', university: 'Continental', type: 'Habitación',
  price: null, deposit: null, minutes: null, amenities: [], description: '', rules: '', address: '', photos: [],
  latitude: null, longitude: null, distanceKm: null, whatsapp: '',
};

@Component({
  selector: 'app-room-form',
  imports: [FormsModule, RoomLocationPicker, UiIcon],
  templateUrl: './room-form.html',
  styleUrl: './room-form.css',
})
export class RoomForm {
  readonly initial = input<RoomDraft>();
  readonly checkPhoto = input(false);
  readonly initialStep = input(0);
  readonly progressKey = input<string>();
  readonly saved = output<RoomDraft>();
  private readonly photoInput = viewChild<ElementRef<HTMLInputElement>>('photos');
  private readonly stepHeading = viewChild<ElementRef<HTMLElement>>('stepHeading');
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  protected readonly steps = ['Ubicación', 'Alojamiento', 'Servicios y fotos'];
  protected readonly step = signal(0);
  protected readonly backwards = signal(false);
  protected readonly saveError = signal('');
  protected readonly zones = zones;
  protected readonly universities = universities;
  protected readonly types = roomTypes;
  protected readonly amenities = amenities;
  protected readonly amenityIcons = amenityIcons;
  protected readonly loadingPhotos = signal(false);
  protected readonly photoError = signal('');
  protected readonly submitted = signal(false);
  protected readonly showLocationMap = signal(false);
  protected draft: RoomFields = { ...emptyRoom };

  constructor() {
    afterNextRender(() => {
      const key = this.progressKey();
      if (this.checkPhoto()) {
        this.step.set(2);
        afterNextRender(() => this.photoInput()?.nativeElement.focus(), { injector: this.injector });
      } else if (!this.initial() && key) {
        try {
          const saved = this.document.defaultView?.sessionStorage.getItem(key);
          if (saved) {
            const progress = JSON.parse(saved) as { draft: RoomFields; step: number };
            this.draft = { ...emptyRoom, ...progress.draft };
            this.changeStep(Number.isInteger(progress.step) && progress.step >= 0 && progress.step < this.steps.length ? progress.step : 0);
          }
        } catch {
          this.saveError.set('No pudimos recuperar el avance guardado en esta pestaña.');
        }
      } else if (this.initial()) {
        this.focusStep();
      }
    });
  }

  ngOnChanges() {
    this.draft = { ...(this.initial() ?? emptyRoom) };
    this.step.set(this.initialStep());
  }

  protected toggleAmenity(amenity: Amenity, selected: boolean) {
    this.draft.amenities = selected
      ? [...this.draft.amenities, amenity]
      : this.draft.amenities.filter(value => value !== amenity);
  }

  protected async addPhotos(input: HTMLInputElement) {
    const files = Array.from(input.files ?? []);
    input.value = '';
    this.photoError.set('');
    if (files.length + this.draft.photos.length > 3 || files.some(file =>
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 20_000_000,
    )) {
      this.photoError.set('Puedes añadir hasta 3 fotos JPG, PNG o WebP de 20 MB como máximo cada una.');
      return;
    }
    this.loadingPhotos.set(true);
    try {
      const photos: RoomPhoto[] = [];
      for (const file of files) {
        const blob = await resizePhoto(file);
        const src = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        photos.push({ src, alt: 'Foto de la habitación' });
      }
      this.draft.photos = [...this.draft.photos, ...photos];
    } catch {
      this.photoError.set('No pudimos preparar las fotos. Prueba con otro archivo JPG, PNG o WebP.');
    } finally {
      this.loadingPhotos.set(false);
    }
  }

  protected removePhoto(index: number) {
    this.draft.photos = this.draft.photos.filter((_, position) => position !== index);
  }

  protected normalizeWhatsapp() {
    this.draft.whatsapp = normalizeWhatsapp(this.draft.whatsapp ?? '');
  }

  protected whatsappValid() {
    return /^[1-9][0-9]{7,14}$/.test(normalizeWhatsapp(this.draft.whatsapp ?? ''));
  }

  protected locationValid() {
    return isHuancayoPoint(this.draft.latitude, this.draft.longitude);
  }

  protected setLocation([latitude, longitude]: MapPoint) {
    this.draft.latitude = latitude;
    this.draft.longitude = longitude;
  }

  protected useZoneReference() {
    this.setLocation(zonePoints[this.draft.zone]);
    if (!this.draft.address.trim()) this.draft.address = `${this.draft.zone}, Huancayo`;
  }

  protected changeStep(next: number) {
    this.backwards.set(next < this.step());
    this.submitted.set(false);
    this.step.set(next);
    afterNextRender(() => this.focusStep(), { injector: this.injector });
  }

  private focusStep() {
    const heading = this.stepHeading()?.nativeElement;
    heading?.focus({ preventScroll: true });
    heading?.closest('form')?.scrollIntoView?.({ block: 'start', behavior: 'instant' });
  }

  protected saveAndExit() {
    const key = this.progressKey();
    if (!key || this.loadingPhotos()) return;
    try {
      const storage = this.document.defaultView?.sessionStorage;
      if (!storage) throw new Error();
      storage.setItem(key, JSON.stringify({ draft: this.draft, step: this.step() }));
    } catch {
      this.saveError.set('No pudimos guardar el avance. Puedes seguir completando el anuncio aquí.');
      return;
    }
    void this.router.navigateByUrl('/propietario');
  }

  protected submit(form: NgForm) {
    this.submitted.set(true);
    const step = this.step();
    if (step === 1) this.normalizeWhatsapp();
    const { price, deposit, minutes, title, description, rules, address, latitude, longitude } = this.draft;
    const locationComplete = latitude != null && longitude != null && this.locationValid() && !!address.trim();
    const detailsComplete = price !== null && deposit !== null && minutes !== null &&
      !!title.trim() && !!description.trim() && !!rules.trim() && this.whatsappValid();
    if (form.invalid || this.loadingPhotos() || (step === 0 && !locationComplete) || (step === 1 && !detailsComplete)) {
      form.control.markAllAsTouched();
      return;
    }
    if (step < 2) {
      this.changeStep(step + 1);
      return;
    }
    if (!locationComplete || !detailsComplete) {
      this.changeStep(locationComplete ? 1 : 0);
      return;
    }
    this.saved.emit({
      ...this.draft, price, deposit, minutes, title: title.trim(), description: description.trim(),
      rules: rules.trim(), address: address.trim(),
    });
  }
}

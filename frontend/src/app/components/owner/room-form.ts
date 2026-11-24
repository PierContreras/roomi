import { Component, input, output, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { amenities, Amenity, RoomDraft, RoomPhoto, roomTypes, universities, zones } from '../../interfaces/room';
import { normalizeWhatsapp } from '../rooms/room-contact';

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
  imports: [FormsModule],
  templateUrl: './room-form.html',
  styles: ['.thumbnails { display: flex; flex-wrap: wrap; gap: 10px; } .thumbnails img { display: block; width: 100px; height: 70px; object-fit: cover; border-radius: 8px; } .thumbnails button { margin-top: 5px; }'],
})
export class RoomForm {
  readonly initial = input<RoomDraft>();
  readonly saved = output<RoomDraft>();
  protected readonly zones = zones;
  protected readonly universities = universities;
  protected readonly types = roomTypes;
  protected readonly amenities = amenities;
  protected readonly loadingPhotos = signal(false);
  protected readonly photoError = signal('');
  protected readonly submitted = signal(false);
  protected draft: RoomFields = { ...emptyRoom };

  ngOnChanges() {
    this.draft = { ...(this.initial() ?? emptyRoom) };
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
    return !this.draft.whatsapp || /^[1-9][0-9]{7,14}$/.test(this.draft.whatsapp);
  }

  protected submit(form: NgForm) {
    this.submitted.set(true);
    this.normalizeWhatsapp();
    const { price, deposit, minutes, title, description, rules, address, latitude, longitude } = this.draft;
    if (form.invalid || !this.whatsappValid() || this.loadingPhotos() || price === null || deposit === null || minutes === null ||
        latitude == null || longitude == null || !title.trim() || !description.trim() || !rules.trim() || !address.trim()) {
      form.control.markAllAsTouched();
      return;
    }
    this.saved.emit({
      ...this.draft, price, deposit, minutes, title: title.trim(), description: description.trim(),
      rules: rules.trim(), address: address.trim(),
    });
  }
}

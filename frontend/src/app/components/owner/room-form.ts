import { Component, input, output, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { amenities, Amenity, RoomDraft, RoomPhoto, roomTypes, universities, zones } from '../../interfaces/room';

interface RoomFields extends Omit<RoomDraft, 'price' | 'deposit' | 'minutes'> {
  price: number | null;
  deposit: number | null;
  minutes: number | null;
}

const emptyRoom: RoomFields = {
  title: '', zone: 'San Carlos', university: 'Continental', type: 'Habitación',
  price: null, deposit: null, minutes: null, amenities: [], description: '', rules: '', address: '', photos: [],
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
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 400_000,
    )) {
      this.photoError.set('Puedes añadir hasta 3 fotos JPG, PNG o WebP de 400 KB como máximo cada una.');
      return;
    }
    this.loadingPhotos.set(true);
    try {
      const photos = await Promise.all(files.map(file => new Promise<RoomPhoto>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ src: String(reader.result), alt: 'Fotografía referencial de la habitación' });
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      })));
      this.draft.photos = [...this.draft.photos, ...photos];
    } catch {
      this.photoError.set('No se pudieron leer las fotos. Vuelve a seleccionarlas.');
    } finally {
      this.loadingPhotos.set(false);
    }
  }

  protected removePhoto(index: number) {
    this.draft.photos = this.draft.photos.filter((_, position) => position !== index);
  }

  protected submit(form: NgForm) {
    this.submitted.set(true);
    const { price, deposit, minutes, title, description, rules, address } = this.draft;
    if (form.invalid || this.loadingPhotos() || price === null || deposit === null || minutes === null ||
        !title.trim() || !description.trim() || !rules.trim() || !address.trim()) {
      form.control.markAllAsTouched();
      return;
    }
    this.saved.emit({
      ...this.draft, price, deposit, minutes, title: title.trim(), description: description.trim(),
      rules: rules.trim(), address: address.trim(),
    });
  }
}

import { afterNextRender, signal } from '@angular/core';

export function browserState<T>(key: string, initial: T) {
  const state = signal(initial);
  afterNextRender(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) state.set(JSON.parse(stored) as T);
    } catch {
      // La demostración sigue usando el estado en memoria.
    }
  });
  return {
    value: state.asReadonly(),
    set(value: T) {
      state.set(value);
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // El almacenamiento puede estar deshabilitado o sin espacio.
      }
    },
  };
}

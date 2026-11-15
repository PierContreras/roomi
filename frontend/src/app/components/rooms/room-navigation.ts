import { computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Params } from '@angular/router';

export const filterParamKeys = ['zona', 'universidad', 'tipo', 'precio', 'minutos', 'servicio'];
const searchParamKeys = [...filterParamKeys, 'vista', 'zonaMapa', 'orden'];

export function searchQuery(params: ParamMap): Params {
  return Object.fromEntries(searchParamKeys.filter(key => params.has(key)).map(key => {
    const values = params.getAll(key);
    return [key, values.length === 1 ? values[0] : values];
  }));
}

export function roomNavigation() {
  const route = inject(ActivatedRoute);
  const params = toSignal(route.queryParamMap, { initialValue: route.snapshot.queryParamMap });
  const origin = computed(() => params().get('origen'));
  const query = computed(() => {
    if (origin() === 'buscar') return searchQuery(params());
    const pair = params().getAll('comparar');
    return origin() === 'guardados' && pair.length === 2 ? { comparar: pair } : {};
  });
  const back = computed(() => {
    switch (origin()) {
      case 'explorar': return { path: '/explorar', label: 'Volver a explorar' };
      case 'guardados': return { path: '/guardados', label: 'Volver a guardados' };
      default: return { path: '/buscar', label: 'Volver a los resultados' };
    }
  });
  const detailQuery = computed(() => ({ ...query(), origen: origin() }));
  return { back, query, detailQuery };
}

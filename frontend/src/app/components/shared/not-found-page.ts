import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink],
  template: `
    <section class="page stack" aria-labelledby="not-found-title">
      <h1 id="not-found-title">Página no encontrada</h1>
      <p>La página que buscas no existe o cambió de dirección.</p>
      <div class="actions">
        <a class="button" routerLink="/explorar">Ir al inicio</a>
        <a class="button quiet" routerLink="/buscar">Buscar habitaciones</a>
      </div>
    </section>
  `,
})
export class NotFoundPage {}

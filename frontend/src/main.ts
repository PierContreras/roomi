import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Los enlaces internos abren la ficha con una copia de la sesión y descartan el acceso a la pestaña original.
window.opener = null;

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));

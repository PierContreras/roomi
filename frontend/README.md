# ROOMI · Frontend

Directorio de alojamiento estudiantil en Huancayo. La aplicación utiliza Angular 22 y consume la API de ROOMI.

## Ejecutar en Windows

Desde la raíz de ROOMI, en PowerShell:

```powershell
cd .\frontend
npm.cmd ci
npx.cmd ng serve
```

Usa `npm.cmd ci` al preparar una copia nueva o al actualizar las dependencias. Para los siguientes arranques basta con `npx.cmd ng serve`. [Abrir ROOMI](http://localhost:4200)

Inicia también FastAPI en `127.0.0.1:8000` siguiendo la [guía del backend](../backend/README.md#ejecutar-en-windows). En desarrollo, Angular reenvía `/api` a FastAPI mediante [proxy.conf.json](proxy.conf.json).

En producción, el servidor de Angular reenvía `/api` a FastAPI. Configura `ROOMI_API_URL` en ese servidor si FastAPI usa otro origen.

```powershell
npm.cmd run build
npm.cmd test -- --watch=false
```

## Inicio de sesión con JWT

`SessionService` envía las credenciales a `POST /api/auth/login`. FastAPI verifica la cuenta y devuelve un JWT firmado, válido por una hora. Angular guarda la sesión en el navegador para recuperarla al recargar o reabrir ROOMI y envía `Authorization: Bearer <token>` en las solicitudes protegidas. FastAPI valida la firma, el vencimiento y los permisos por rol. Cerrar sesión elimina la sesión guardada y sincroniza las pestañas abiertas del mismo sitio.

Desde `/registro` se crea una cuenta para buscar, publicar y reseñar alojamientos. La misma cuenta permite buscar habitaciones y gestionar tus publicaciones.

## Diseño y arquitectura

Los formularios usan controles nativos con los estilos de ROOMI. Los iconos de navegación y de formularios se incluyen en el propio frontend.

- El mapa usa Leaflet y OpenStreetMap para anuncios con coordenadas y una vista esquemática por zona para los demás.
- SweetAlert2 se carga desde la aplicación para avisos y confirmaciones. Chart.js se carga desde CDN al abrir una comparación. Los mensajes, el diálogo de retiro y la tabla de precios también funcionan si el CDN no responde.
- `src/app/components/` contiene las páginas, sus plantillas y estilos. `src/app/interfaces/` contiene los modelos. `src/app/services/` contiene los servicios que consumen FastAPI con `HttpClient`.

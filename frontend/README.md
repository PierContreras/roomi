# ROOMI · Frontend

Directorio de alojamiento estudiantil en Huancayo. La aplicación utiliza Angular 22 y consume la API de ROOMI.

## Ejecutar en Windows

Desde la raíz de ROOMI, en PowerShell:

```powershell
cd .\frontend
npm.cmd ci
npm.cmd start
```

Abre [http://localhost:4200](http://localhost:4200). Si `node_modules` ya está instalado, puedes omitir `npm.cmd ci`.

Inicia también FastAPI en `127.0.0.1:8000` siguiendo la [guía del backend](../backend/README.md#ejecutar-en-windows). Angular solicita `/api` al mismo origen. En desarrollo, el proxy de Angular CLI reenvía las peticiones a FastAPI según `proxy.conf.json`.

En producción, el servidor de Angular reenvía `/api` a FastAPI. Configura `ROOMI_API_URL` en ese servidor si FastAPI usa otro origen.

```powershell
npm.cmd run build
npm.cmd test -- --watch=false
```

## Inicio de sesión con JWT

`SessionService` envía las credenciales a `POST /api/auth/login`. FastAPI verifica la cuenta y devuelve un JWT firmado. Angular conserva la sesión en `sessionStorage` para recuperarla al recargar la misma pestaña y envía `Authorization: Bearer <token>` en las solicitudes protegidas. FastAPI valida la firma, el vencimiento y los permisos por rol. Angular elimina la sesión guardada al cerrar sesión o al vencer el token.

Desde `/registro` se crea una cuenta para buscar, publicar y reseñar alojamientos. Para crear una cuenta de administración, usa el comando de la [guía del backend](../backend/README.md#ejecutar-en-windows).

## Diseño y arquitectura

- El [prototipo de ROOMI](https://www.figma.com/design/z05ZuphiD9C9zP1KAr9ndG/Prototipo?node-id=0-1) aportó el catálogo de frames y la referencia detallada de inicio móvil (`26:85`). Para las pantallas sin contexto detallado se utilizaron la composición del inicio, la propuesta y los nombres y dimensiones de los frames. Queda pendiente cotejar la fidelidad visual de esas pantallas y descargar las fotos del prototipo. La galería admite las fotos de prueba cargadas por el propietario.
- El catálogo de Figma disponible incluye el flujo de publicación del propietario. Para los paneles de propietario y moderación se usaron la propuesta y el estilo compartido de ROOMI.
- El mapa usa Leaflet y OpenStreetMap para anuncios con coordenadas y una vista esquemática por zona para los demás.
- SweetAlert2 y Chart.js se cargan desde CDN al solicitar una confirmación, un aviso o una comparación. Los mensajes, el diálogo de retiro y la tabla de precios también funcionan si el CDN no responde.
- `src/app/components/` contiene las páginas, sus plantillas y estilos. `src/app/interfaces/` contiene los modelos. `src/app/services/` contiene los servicios que consumen FastAPI con `HttpClient`.

# ROOMI · Frontend

Directorio demostrativo de alojamiento estudiantil en Huancayo. La aplicación utiliza Angular 22 y los anuncios de ejemplo usan precios en soles.

## Ejecutar en Windows

Desde la raíz de ROOMI, en PowerShell:

```powershell
cd .\frontend
npm.cmd ci
npm.cmd start
```

Abre [http://localhost:4200](http://localhost:4200). Si `node_modules` ya está instalado, puedes omitir `npm.cmd ci`.

Inicia también FastAPI en `127.0.0.1:8000` siguiendo [las instrucciones del backend](../backend/README.md#probar-con-sql-server). `npm.cmd start` reenvía las consultas del catálogo hacia esa dirección. El servidor de Angular compilado usa la misma dirección por defecto y admite `ROOMI_API_URL` para indicar el origen de FastAPI.

```powershell
npm.cmd run build
npm.cmd test -- --watch=false
```

## Recorridos de demostración

| Etapa | Pantallas y rutas | Cómo probar | Operaciones simuladas |
| --- | --- | --- | --- |
| Base | Inicio público en `/`, encabezado, menú móvil y pie | Explora como invitado o selecciona **Iniciar sesión** para probar otro perfil | Acceso y perfiles de demostración |
| Estudiante | `/explorar`, `/buscar`, `/habitaciones/:id`, `/habitaciones/:id/contacto`, `/habitaciones/:id/compartir`, `/guardados` | Busca en San Carlos, aplica un precio máximo, selecciona **Comparar precios** y abre una ficha. Al volver a los resultados se conservan los filtros. | Ubicación aproximada y preparación de consultas |
| Ayuda | `/ayuda` | Busca una pregunta o completa el formulario con datos ficticios | Consulta de soporte y confirmación local |
| Propietario | `/acceso`, `/registro`, `/propietario`, `/propietario/nuevo`, `/propietario/:id/editar` | Entra como **Propietario**. Crea un anuncio con datos ficticios, revisa y envía. Edita sus datos y retíralo desde **Mis anuncios** | Cuenta, inicio de sesión, estados y almacenamiento local |
| Administrador | `/administracion`, `/administracion/:id` | Cierra sesión y entra como **Administrador**. Aprueba un anuncio pendiente o recházalo con motivo. Vuelve a **Propietario** en la misma pestaña y comprueba el nuevo estado | Cola y decisiones de moderación compartidas entre los paneles |

Los perfiles precargados son `estudiante@roomi.test`, `propietario@roomi.test` y `administrador@roomi.test`. Su contraseña de demostración es `roomi123`. También puedes seleccionar un perfil directamente en el acceso. Las cuentas creadas mediante el registro sirven para el recorrido de esa sesión. La sesión se reinicia al recargar la página. Los anuncios de demostración del propietario y los identificadores de los favoritos se conservan en ese navegador, cuando su almacenamiento está disponible.

## Diseño y arquitectura

- El [prototipo de ROOMI](https://www.figma.com/design/z05ZuphiD9C9zP1KAr9ndG/Prototipo?node-id=0-1) aportó el catálogo de frames y la referencia detallada de inicio móvil (`26:85`). Para las pantallas sin contexto detallado se utilizaron la composición del inicio, la propuesta y los nombres y dimensiones de los frames. Queda pendiente cotejar la fidelidad visual de esas pantallas y descargar las fotos del prototipo. La galería admite las fotos de prueba cargadas por el propietario.
- El catálogo de Figma disponible incluye el flujo de publicación del propietario. Para los paneles de propietario y moderación se usaron la propuesta y el estilo compartido de ROOMI.
- El mapa usa marcadores interactivos por zona sobre una vista esquemática. La cartografía propuesta con Leaflet y OpenStreetMap queda pendiente.
- SweetAlert2 y Chart.js se cargan desde CDN al solicitar una confirmación, un aviso o una comparación. Los mensajes, el diálogo de retiro y la tabla de precios también funcionan si el CDN no responde.
- `src/app/components/` contiene las páginas y los componentes de ROOMI con sus plantillas y estilos. `src/app/interfaces/` contiene los modelos de alojamiento y usuario. `RoomService` consulta el catálogo público en FastAPI y conserva las operaciones locales de propietario y moderación. `SessionService` gestiona el acceso de demostración.

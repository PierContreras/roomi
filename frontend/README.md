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

```powershell
npm.cmd run build
npm.cmd test -- --watch=false
```

## Recorridos de demostración

| Etapa | Pantallas y rutas | Cómo probar | Operaciones simuladas |
| --- | --- | --- | --- |
| Base | Acceso inicial en `/`, encabezado, menú móvil y pie | Abre **Menú** en móvil o selecciona **Seguir explorando como invitado** | Acceso y perfiles de demostración |
| Estudiante | `/explorar`, `/buscar`, `/habitaciones/:id`, `/habitaciones/:id/contacto`, `/habitaciones/:id/compartir`, `/guardados` | Busca en San Carlos, aplica un precio máximo, abre una ficha y prepara una consulta o copia el enlace | Filtros, ubicación aproximada, contactos, fotos referenciales y consultas |
| Ayuda | `/ayuda` | Busca una pregunta o completa el formulario con datos ficticios | Consulta de soporte y confirmación local |
| Propietario | `/acceso`, `/registro`, `/propietario`, `/propietario/nuevo`, `/propietario/:id/editar` | Entra como **Propietario**. Crea un anuncio con datos ficticios, revisa y envía. Edita sus datos y retíralo desde **Mis anuncios** | Cuenta, inicio de sesión, estados y almacenamiento local |
| Administrador | `/administracion`, `/administracion/:id` | Cierra sesión y entra como **Administrador**. Aprueba un anuncio pendiente o recházalo con motivo. Vuelve a **Propietario** en la misma pestaña y comprueba el nuevo estado | Cola y decisiones de moderación compartidas entre los paneles |

Los perfiles precargados son `estudiante@roomi.test`, `propietario@roomi.test` y `administrador@roomi.test`. Su contraseña de demostración es `roomi123`. También puedes seleccionar un perfil directamente en el acceso. Las cuentas creadas mediante el registro sirven para el recorrido de esa sesión. La sesión se reinicia al recargar la página. Los anuncios y los guardados se conservan en el almacenamiento de ese navegador, cuando está disponible.

## Diseño y arquitectura

- El [prototipo de ROOMI](https://www.figma.com/design/z05ZuphiD9C9zP1KAr9ndG/Prototipo?node-id=0-1) aportó el catálogo de frames y la referencia detallada de inicio móvil (`26:85`). Para las pantallas sin contexto detallado se utilizaron la composición del inicio, la propuesta y los nombres y dimensiones de los frames. Queda pendiente cotejar la fidelidad visual de esas pantallas y descargar las fotos del prototipo. La galería admite las fotos de prueba cargadas por el propietario.
- El catálogo de Figma disponible incluye el flujo de publicación del propietario. Para los paneles de propietario y moderación se usaron la propuesta y el estilo compartido de ROOMI.
- El mapa usa marcadores interactivos por zona sobre una vista esquemática. La cartografía propuesta con Leaflet y OpenStreetMap queda pendiente.
- `src/app/components/` contiene las páginas y los componentes de ROOMI con sus plantillas y estilos. `src/app/interfaces/` contiene los modelos de alojamiento y usuario. `src/app/services/` reúne el catálogo, la moderación, la sesión y el control de acceso simulado. Los archivos raíz de Angular están en `src/app/`. `RoomService` y `SessionService` son los puntos previstos para integrar FastAPI por HTTP. La base de datos pertenece a la futura capa del backend.

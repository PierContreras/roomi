# Backend de ROOMI

FastAPI recibe las solicitudes de Angular, aplica validación y permisos y guarda los datos en SQL Server mediante `pyodbc` y Microsoft ODBC Driver 18. Usa `uv` para instalar las dependencias de Python.

## Autenticación

Una cuenta con el rol Usuario puede buscar, publicar, gestionar sus propios anuncios y reseñar alojamientos de otras personas. Cada anuncio conserva la referencia al usuario que lo publicó.

La tabla `dbo.roles` contiene Usuario (`user`) y Administrador (`admin`). Cada cuenta referencia un rol mediante `dbo.usuarios.rol_id`. En `/administracion`, los administradores pueden consultar usuarios, anuncios, reportes, reseñas, consultas e historial de moderación, y eliminar cualquier anuncio con un motivo. La eliminación quita el anuncio del catálogo y registra la decisión y su responsable. El rol se asigna desde la terminal del backend a una cuenta registrada con `uv run --locked python asignar_administrador.py --email usuario@example.com`.

`POST /api/auth/registro` y `POST /api/auth/login` devuelven el perfil y un JWT firmado con HS256 mediante PyJWT. Configura `ROOMI_JWT_SECRET` con una clave aleatoria de al menos 32 bytes. El token vence después de una hora y se envía mediante `Authorization: Bearer <token>` en las solicitudes protegidas.

Las cuentas nuevas usan `argon2-cffi` con Argon2id. SQL Server guarda el hash en `dbo.usuarios.password_hash`, de tipo `NVARCHAR(250) NOT NULL`. Las cuentas anteriores con scrypt conservan su contraseña y su hash se actualiza a Argon2id tras un inicio de sesión correcto.

## Publicación y reportes

Cualquier cuenta registrada puede publicar y gestionar sus anuncios. La publicación comprueba que el anuncio incluya una foto, un precio permitido y un título y descripción sin datos de contacto externos ni términos restringidos. Si falla, la API indica qué corregir. Los borradores pueden guardarse para completarlos después.

Configura el rango mensual con `ROOMI_PRECIO_MINIMO` y `ROOMI_PRECIO_MAXIMO`, cuyos valores iniciales son 50 y 2000 soles. `ROOMI_TERMINOS_PROHIBIDOS` admite una lista separada por comas y empieza vacía.

Cada cuenta puede reportar un anuncio una vez. El reporte se guarda en SQL Server y el anuncio sigue disponible en el catálogo. En Mis anuncios, los anuncios antiguos pendientes o rechazados aparecen como borradores que sus propietarios pueden corregir y publicar.

## Contacto por WhatsApp

ROOMI abre WhatsApp desde la ficha con un mensaje editable. Para una cuenta con sesión iniciada, `GET /api/alojamientos/{anuncio_id}/contacto` devuelve el número del propietario. El número es obligatorio al publicar o reactivar un anuncio. La API de consultas permanece disponible para compatibilidad y conserva los registros anteriores.

## Eliminar una publicación

El propietario puede llamar a `DELETE /api/alojamientos/{anuncio_id}` con su JWT. La operación devuelve `204` y quita el anuncio del catálogo y de Mis anuncios. Las consultas, reseñas, reportes y decisiones de moderación asociados se conservan en la base.

## Instalar el esquema en SQL Server

Desde la raíz del repositorio, ejecuta lo siguiente con una cuenta autorizada para administrar la base local.

```powershell
sqlcmd -S . -E -C -b -i .\backend\migrations\instalar_roomi.sql
```

El script crea `BD_ROOMI` en instalaciones nuevas. Si la base existente se llama `ROOMI`, la renombra antes de aplicar las migraciones. Cierra las conexiones a esa base antes de ejecutar el cambio de nombre. Tras el cambio, usa `DB_NAME=BD_ROOMI` en `.env`. El script puede volver a ejecutarse y muestra las doce tablas esperadas.

El instalador incluye [006_moderacion_mixta.sql](migrations/006_moderacion_mixta.sql), [007_normalizar_catalogo.sql](migrations/007_normalizar_catalogo.sql), [008_whatsapp_consultas.sql](migrations/008_whatsapp_consultas.sql) y [009_seguimiento_alquiler.sql](migrations/009_seguimiento_alquiler.sql). Verifica el destino con `SELECT DB_NAME()` antes de ejecutarlas y confirma la base en `/api/salud` después del arranque.

## Ejecutar en Windows

Desde `backend`, instala las dependencias y prepara el archivo local de configuración.

```powershell
$env:UV_PROJECT_ENVIRONMENT = '.venv-roomi'
uv sync --locked --python (Get-Command python.exe).Source
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Configura la instancia de SQL Server en `.env`. Para una instalación nueva, genera el valor de `ROOMI_JWT_SECRET` con `python.exe -c "import secrets; print(secrets.token_hex(32))"` y guárdalo en `.env`. Si la instancia local usa un certificado autofirmado, configura `DB_TRUST_SERVER_CERTIFICATE=yes` para ese entorno.

```powershell
uv run --locked uvicorn backend.main:app --reload
```

La aplicación carga `backend/.env` automáticamente. Las variables ya definidas en el entorno tienen prioridad. Usa `.env.example` para compartir la configuración de ejemplo y guarda las credenciales únicamente en `.env` o en el entorno del servidor.

Si ya hay un proceso de Uvicorn en el puerto 8000, detenlo con `Ctrl+C` y vuelve a iniciar con el comando anterior. Después abre `/api/salud` para comprobar la conexión a `BD_ROOMI` y `/api/alojamientos` para comprobar el catálogo público.

## Autorización y errores de la API

| Estado | Criterio |
| --- | --- |
| 401 | La operación exige una sesión válida y la sesión está ausente, es inválida o venció. En el acceso, las credenciales no coinciden. |
| 403 | La sesión es válida, pero el rol no permite la operación. Por ejemplo, un arrendatario no puede moderar anuncios. |
| 404 | El recurso no existe o la operación no está disponible para esa cuenta por titularidad. Editar, retirar o eliminar un anuncio ajeno se trata como si no existiera. La reseña del anuncio propio también se oculta con este estado. |
| 409 | La solicitud entra en conflicto con el estado actual, como un correo duplicado, una reseña repetida o un cambio de estado incompatible. |
| 422 | La solicitud tiene datos inválidos. La respuesta incluye mensajes en español por campo. |

OpenAPI documenta los estados aplicables a cada operación con el modelo compartido `ErrorApi`. Las respuestas protegidas con 401 incluyen `WWW-Authenticate: Bearer`.

## Estructura

- `src/backend/apis/` expone el catálogo, acceso, gestión de anuncios, contacto, reseñas y reportes.
- `src/backend/schemas/` define los contratos HTTP.
- `src/backend/services/` aplica filtros y proporciona el hash y la firma de sesiones.
- `src/backend/repositories/` consulta y actualiza SQL Server.
- `migrations/` prepara el esquema. `create_table.py --datos-demo` carga ejemplos en una base local ya preparada.

## Fotos de alojamientos

FastAPI guarda las fotos en `uploads/alojamientos`, dentro del backend. SQL Server conserva la dirección relativa `/api/media/alojamientos/<archivo>` en `dbo.alojamiento_fotos.src`. Incluye la carpeta de fotos junto con la base de datos en las copias de seguridad.

Para convertir las fotos guardadas anteriormente como Base64, activa el entorno del backend y ejecuta `uv run --locked python migrar_fotos.py` desde esta carpeta. El comando usa la conexión configurada para el backend y se puede repetir.

[Swagger local](http://127.0.0.1:8000/docs) · [Estado de la API](http://127.0.0.1:8000/api/salud)

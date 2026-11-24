# Backend de ROOMI

FastAPI recibe las solicitudes de Angular, aplica validación y permisos y guarda los datos en SQL Server mediante `pyodbc` y Microsoft ODBC Driver 18. `uv sync --locked` instala las dependencias de Python.

## Autenticación

Una cuenta de ROOMI permite publicar, gestionar sus propios anuncios y reseñar alojamientos de otras personas. Las cuentas existentes con rol `student` u `owner` tienen los mismos permisos de usuario. El rol `admin` tiene acceso al panel de moderación.

`POST /api/auth/registro` y `POST /api/auth/login` devuelven el perfil y un JWT firmado con HS256 mediante PyJWT. Configura `ROOMI_JWT_SECRET` con una clave aleatoria de al menos 32 bytes. El token vence después de una hora y se envía mediante `Authorization: Bearer <token>` en las solicitudes protegidas.

Los registros nuevos y las cuentas de administración creadas por consola usan `argon2-cffi` con Argon2id. SQL Server guarda el hash en `dbo.usuarios.password_hash`, de tipo `NVARCHAR(250) NOT NULL`. Las cuentas anteriores con scrypt conservan su contraseña y su hash se actualiza a Argon2id tras un inicio de sesión correcto.

## Eliminar una publicación

El propietario puede llamar a `DELETE /api/alojamientos/{anuncio_id}` con su JWT. La operación devuelve `204` y quita el anuncio del catálogo y de Mis anuncios. Las consultas, reseñas, reportes y decisiones de moderación asociados se conservan en la base.

## Instalar el esquema en SQL Server

Desde la raíz del repositorio, ejecuta lo siguiente con una cuenta autorizada para administrar la base local.

```powershell
sqlcmd -S . -E -C -b -i .\backend\migrations\instalar_roomi.sql
```

El script crea `BD_ROOMI` en instalaciones nuevas. Si la base existente se llama `ROOMI`, la renombra antes de aplicar las migraciones. Cierra las conexiones a esa base antes de ejecutar el cambio de nombre. Tras el cambio, usa `DB_NAME=BD_ROOMI` en `.env`. El script puede volver a ejecutarse y muestra las seis tablas esperadas.

## Ejecutar en Windows

Desde `backend`, instala las dependencias y prepara el archivo local de configuración.

```powershell
uv sync --locked
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Configura la instancia de SQL Server en `.env`. Para una instalación nueva, genera el valor de `ROOMI_JWT_SECRET` con `.\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_hex(32))"` y guárdalo en `.env`. Si la instancia local usa un certificado autofirmado, configura `DB_TRUST_SERVER_CERTIFICATE=yes` para ese entorno.

```powershell
.\.venv\Scripts\python.exe -m uvicorn src.backend.main:app --host 127.0.0.1 --port 8000 --reload
```

El arranque mediante `python.exe -m uvicorn` es compatible con Smart App Control. La aplicación carga `backend/.env` automáticamente. Las variables ya definidas en el entorno tienen prioridad. Usa `.env.example` para compartir la configuración de ejemplo y guarda las credenciales únicamente en `.env` o en el entorno del servidor.

Si ya hay un proceso de Uvicorn en el puerto 8000, detenlo con `Ctrl+C` y vuelve a iniciar con el comando anterior. Después abre `/api/salud` para comprobar la conexión a `BD_ROOMI` y `/api/alojamientos` para comprobar el catálogo público.

Si necesitas crear la primera cuenta de administración, ejecuta el siguiente comando. La contraseña se solicita en consola.

```powershell
.\.venv\Scripts\python.exe create_table.py --admin-email administrador@roomi.test
```

## Autorización y errores de la API

| Estado | Criterio |
| --- | --- |
| 401 | La operación exige una sesión válida y la sesión está ausente, es inválida o venció. En el acceso, las credenciales no coinciden. |
| 403 | La sesión es válida, pero el rol no permite la operación. Por ejemplo, un arrendatario no puede moderar anuncios. |
| 404 | El recurso no existe o la operación no está disponible para esa cuenta por titularidad. Editar, retirar o eliminar un anuncio ajeno se trata como si no existiera. La reseña del anuncio propio también se oculta con este estado. |
| 409 | La solicitud entra en conflicto con el estado actual, como un correo duplicado, una reseña repetida o una decisión de moderación desactualizada. |
| 422 | La solicitud tiene datos inválidos. La respuesta incluye mensajes en español por campo. |

OpenAPI documenta los estados aplicables a cada operación con el modelo compartido `ErrorApi`. Las respuestas protegidas con 401 incluyen `WWW-Authenticate: Bearer`.

## Estructura

- `src/backend/apis/` expone el catálogo, acceso, paneles, moderación, contacto, reseñas y reportes.
- `src/backend/schemas/` define los contratos HTTP.
- `src/backend/services/` aplica filtros y proporciona el hash y la firma de sesiones.
- `src/backend/repositories/` consulta y actualiza SQL Server.
- `migrations/` y `create_table.py` preparan la base y su esquema.

[Swagger local](http://127.0.0.1:8000/docs) · [Estado de la API](http://127.0.0.1:8000/api/salud)

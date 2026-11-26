# Instrucciones para trabajar en el backend

- Mantén FastAPI como API de ROOMI y `BD_ROOMI` como base en SQL Server. Usa `pyodbc` con Microsoft ODBC Driver 18 y reutiliza `src/backend/db_connection.py`.
- Define las rutas HTTP en `apis/`, los modelos de entrada y salida en `schemas/`, las reglas de negocio en `services/` y las consultas en `repositories/`.
- Mantén las rutas públicas bajo `/api` y coordina cualquier cambio de contrato con el frontend. Verifica los permisos y la titularidad de los anuncios en el servidor.
- Usa consultas parametrizadas y migraciones versionadas y repetibles en `migrations/`. Conserva los datos existentes al modificar el esquema.
- Usa JWT para la sesión y Argon2id para las contraseñas. Configura los secretos en `.env` y documenta las variables nuevas en `.env.example`.
- Antes de entregar, verifica las rutas afectadas en Swagger o con una prueba de API. Comprueba `/api/salud` cuando SQL Server esté disponible y usa una base de pruebas para las operaciones de escritura.

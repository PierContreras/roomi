# Backend de ROOMI

API en FastAPI para el directorio de alojamiento estudiantil. Expone la consulta de anuncios publicados con datos de demostración en memoria o con SQL Server.

## Iniciar

Desde la raíz del repositorio, en PowerShell:

```powershell
cd .\backend
uv sync
uv run uvicorn backend.main:app --reload
```

Abre [Swagger UI](http://127.0.0.1:8000/docs). Si la descarga de dependencias está restringida y ya tienes FastAPI y Uvicorn instalados en tu Python, puedes usar `python -m uvicorn backend.main:app --app-dir src --reload`.

| Método | Ruta | Resultado |
| --- | --- | --- |
| GET | `/api/salud` | Confirma que la API está disponible |
| GET | `/api/alojamientos` | Lista de anuncios publicados, con filtros opcionales |
| GET | `/api/alojamientos/{anuncio_id}` | Ficha pública. Devuelve 404 si el anuncio no está disponible |

La lista admite `zona`, `universidad`, `tipo`, `precio` (máximo), `minutos` (máximo) y uno o varios valores `servicio`. Por ejemplo, prueba `/api/alojamientos?zona=San%20Carlos&precio=330&servicio=Wifi`.

## Capas

| Ruta | Responsabilidad |
| --- | --- |
| `src/backend/main.py` | Crea FastAPI, monta las rutas y habilita peticiones desde Angular en el puerto 4200 |
| `src/backend/apis/` | Recibe peticiones HTTP y devuelve las respuestas |
| `src/backend/services/` | Aplica los filtros y las reglas de consulta |
| `src/backend/repositories/` | Define el contrato de repositorio y sus implementaciones en memoria y SQL Server |
| `src/backend/schemas/` | Define los contratos de entrada y de respuesta con Pydantic |
| `src/backend/db_connection.py` | Abre y cierra las conexiones ODBC |
| `create_table.py` | Crea la tabla de alojamientos en una base existente y, si se solicita, agrega ejemplos |

## Probar con SQL Server

1. Ten lista una base de datos de desarrollo y el controlador **Microsoft ODBC Driver 18 for SQL Server**.
2. Desde `backend/`, copia `.env.example` a `.env`. Cambia `ROOMI_DATA_SOURCE` a `sqlserver` y configura `ROOMI_SQLSERVER_CONNECTION_STRING` con tu instancia, base y método de autenticación. Git ignora `.env`.
3. Ejecuta estos comandos. Omite `--datos-demo` si solo quieres crear la tabla.

```powershell
uv sync --extra sqlserver
uv run --extra sqlserver --env-file .env python create_table.py --datos-demo
uv run --extra sqlserver --env-file .env uvicorn backend.main:app --reload
```

El script crea `dbo.alojamientos` si la tabla aún no existe. Con `--datos-demo` agrega los ejemplos únicamente cuando falta su identificador. Para este catálogo inicial, la tabla guarda los servicios y las fotos como listas JSON.

Angular sigue usando su servicio de demostración. La conexión desde Angular, la autenticación y las operaciones de escritura de la API quedan para etapas posteriores.

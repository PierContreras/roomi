# ROOMI

Directorio de alojamiento estudiantil en Huancayo. Usa Angular, FastAPI y SQL Server.

## Arranque local en Windows

Necesitas Git, Node.js 24 con npm, uv con Python 3.14, SQL Server, `sqlcmd` y Microsoft ODBC Driver 18.

### 1. Clona el repositorio y prepara SQL Server

```powershell
git clone https://github.com/PierContreras/roomi.git
cd roomi
sqlcmd -S . -E -C -b -i .\backend\migrations\instalar_roomi.sql
```

Si SQL Server usa una instancia con nombre, cambia `.` por el nombre de tu instancia, por ejemplo `.\SQLEXPRESS`. El instalador prepara una base local `BD_ROOMI`. En una instalación nueva, el catálogo empieza vacío y puedes añadir anuncios desde la web.

### 2. Inicia el backend

Desde la raíz del repositorio:

```powershell
cd .\backend
uv sync --locked
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

En `backend/.env`, configura `DB_HOST` con la misma instancia de SQL Server y mantén `DB_NAME=BD_ROOMI`. Genera una clave para `ROOMI_JWT_SECRET` con `.\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_hex(32))"` y guárdala solo en `.env`.

```powershell
.\.venv\Scripts\python.exe -m uvicorn src.backend.main:app --host 127.0.0.1 --port 8000
```

### 3. Inicia la web

Abre otra terminal desde la raíz del repositorio:

```powershell
cd .\frontend
npm.cmd ci
npm.cmd start
```

Abre [ROOMI](http://localhost:4200). Puedes comprobar la conexión a SQL Server en [el estado de la API](http://127.0.0.1:8000/api/salud).

[Configuración del backend](backend/README.md) · [Configuración del frontend](frontend/README.md)

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
$env:UV_PROJECT_ENVIRONMENT = '.venv-roomi'
uv sync --locked --python (Get-Command python.exe).Source
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

El comando usa el Python 3.14 instalado y disponible en PowerShell como `python.exe`. En `backend/.env`, configura `DB_HOST` con la misma instancia de SQL Server y mantén `DB_NAME=BD_ROOMI`. Genera una clave para `ROOMI_JWT_SECRET` con `python.exe -c "import secrets; print(secrets.token_hex(32))"` y guárdala solo en `.env`.

```powershell
.\.venv-roomi\Scripts\python.exe -m uvicorn src.backend.main:app
```

### 3. Inicia la web

Abre otra terminal desde la raíz del repositorio:

```powershell
cd .\frontend
npm.cmd ci
npm.cmd start
```

Para los siguientes arranques, ejecuta los comandos que inician Uvicorn y Angular en sus respectivas terminales. Déjalas abiertas mientras uses ROOMI.

Abre [ROOMI](http://localhost:4200). Puedes comprobar la conexión a SQL Server en [el estado de la API](http://127.0.0.1:8000/api/salud).

## Ensayo de la demostración

Para cargar cuatro anuncios ficticios con fotos ilustrativas en tu base local, ejecuta desde `backend`:

```powershell
.\.venv-roomi\Scripts\python.exe create_table.py --datos-demo
```

Puedes ejecutar el comando otra vez sin duplicar los ejemplos. Los ejemplos sirven para probar el catálogo. Para demostrar una consulta, crea un anuncio con una cuenta de prueba y usa otra cuenta para contactar desde una ventana privada.

1. Busca por zona, compara el precio y la garantía y abre un anuncio.
2. Publica una habitación con una foto y edita su precio desde **Mis anuncios**.
3. Desde la segunda cuenta, envía una consulta. Verifica que aparezca en **Consultas recibidas** en la primera cuenta.
4. Marca la habitación como ocupada y comprueba que salga del catálogo. Vuelve a marcarla como disponible para mostrarla de nuevo.

[Configuración del backend](backend/README.md) · [Configuración del frontend](frontend/README.md)

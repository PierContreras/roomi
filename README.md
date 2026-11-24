# ROOMI

Buscador de alojamientos estudiantiles en Huancayo. Angular presenta la interfaz, FastAPI expone la API y SQL Server almacena los datos compartidos en la base `BD_ROOMI`. FastAPI usa `pyodbc` con Microsoft ODBC Driver 18 y la base se puede administrar con SQL Server Management Studio.

[Backend y base de datos](backend/README.md) · [Frontend](frontend/README.md)

## Arranque local en Windows

Después de instalar las dependencias y configurar `backend/.env` según la guía del backend, ejecuta estos comandos en dos terminales PowerShell desde la raíz del repositorio.

```powershell
cd .\backend
.\.venv\Scripts\python.exe -m uvicorn src.backend.main:app --host 127.0.0.1 --port 8000 --reload
```

```powershell
cd .\frontend
npm.cmd start
```

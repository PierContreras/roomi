import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.apis.alojamientos import crear_router
from backend.db_connection import ConexionSqlError
from backend.repositories.alojamientos import RepositorioAlojamientosEnMemoria
from backend.repositories.datos_demo import ALOJAMIENTOS_DEMO
from backend.repositories.sql_alojamientos import RepositorioAlojamientosSql
from backend.services.alojamientos import ServicioAlojamientos
from backend.services.exceptions import AlojamientoNoEncontrado

app = FastAPI(title="ROOMI API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://127.0.0.1:4200"],
    allow_methods=["GET"],
)
origen = os.getenv("ROOMI_DATA_SOURCE", "demo").strip().lower()
if origen == "demo":
    repositorio = RepositorioAlojamientosEnMemoria(ALOJAMIENTOS_DEMO)
elif origen == "sqlserver":
    repositorio = RepositorioAlojamientosSql()
else:
    raise ValueError("ROOMI_DATA_SOURCE debe ser demo o sqlserver.")
app.include_router(crear_router(ServicioAlojamientos(repositorio)), prefix="/api")


@app.exception_handler(AlojamientoNoEncontrado)
async def alojamiento_no_encontrado(_request: Request, _error: AlojamientoNoEncontrado) -> JSONResponse:
    return JSONResponse({"detail": "Alojamiento no encontrado."}, status_code=404)


@app.exception_handler(ConexionSqlError)
async def sql_no_disponible(_request: Request, _error: ConexionSqlError) -> JSONResponse:
    return JSONResponse({"detail": "El catálogo no está disponible."}, status_code=503)


@app.get("/api/salud", tags=["Sistema"])
def salud() -> dict[str, str]:
    return {"estado": "ok"}

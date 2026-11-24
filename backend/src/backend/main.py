from contextlib import asynccontextmanager
import logging
from typing import Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, ConfigDict
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.apis.alojamientos import crear_router
from backend.apis.gestion import router as gestion_router
from backend.db_connection import ConexionSqlError, abrir_conexion, validar_configuracion_sql
from backend.repositories.sql_alojamientos import RepositorioAlojamientosSql
from backend.schemas.error import ErrorApi, ErrorCampo
from backend.services.alojamientos import ServicioAlojamientos
from backend.services.exceptions import AlojamientoNoEncontrado

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def ciclo_de_vida(_app: FastAPI):
    validar_configuracion_sql()
    yield


app = FastAPI(
    title="ROOMI API", version="0.2.0", lifespan=ciclo_de_vida,
    responses={503: {"description": "SQL Server o la configuración de sesión no está disponible."}},
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://127.0.0.1:4200"],
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["Location"],
)
app.include_router(
    crear_router(ServicioAlojamientos(RepositorioAlojamientosSql())),
    prefix="/api",
)
app.include_router(gestion_router, prefix="/api")


CODIGOS_ERROR = {
    401: "sesion_no_autorizada",
    403: "acceso_denegado",
    404: "recurso_no_encontrado",
    409: "conflicto",
    422: "validacion_invalida",
    503: "servicio_no_disponible",
}

openapi_original = app.openapi


def openapi_roomi():
    if app.openapi_schema is not None:
        return app.openapi_schema
    esquema = openapi_original()
    modelo = ErrorApi.model_json_schema(ref_template="#/components/schemas/{model}")
    modelos = esquema["components"]["schemas"]
    modelos.update(modelo.pop("$defs"))
    modelos["ErrorApi"] = modelo
    for ruta in esquema["paths"].values():
        for operacion in ruta.values():
            for estado, respuesta in operacion.get("responses", {}).items():
                if int(estado) in CODIGOS_ERROR:
                    respuesta["content"] = {
                        "application/json": {"schema": {"$ref": "#/components/schemas/ErrorApi"}},
                    }
    return esquema


app.openapi = openapi_roomi


def responder_error(estado, detalle, *, campos=None, headers=None):
    cuerpo = ErrorApi(codigo=CODIGOS_ERROR.get(estado, "error_http"), detail=detalle, campos=campos)
    return JSONResponse(cuerpo.model_dump(exclude_none=True), status_code=estado, headers=headers)


@app.exception_handler(StarletteHTTPException)
async def error_http(_request: Request, error: StarletteHTTPException) -> JSONResponse:
    return responder_error(error.status_code, error.detail, headers=error.headers)


def mensaje_validacion(tipo: str) -> str:
    if tipo == "missing":
        return "Este campo es obligatorio."
    if tipo == "json_invalid":
        return "El cuerpo de la solicitud debe ser un JSON válido."
    if tipo.startswith("int_"):
        return "Ingresa un número entero válido."
    if tipo.startswith(("float_", "decimal_")) or tipo == "finite_number":
        return "Ingresa un número válido."
    if tipo in {"greater_than", "greater_than_equal", "less_than", "less_than_equal"}:
        return "El valor está fuera del intervalo permitido."
    if tipo in {"string_too_short", "too_short"}:
        return "El valor es demasiado corto."
    if tipo in {"string_too_long", "too_long"}:
        return "El valor es demasiado largo."
    if tipo in {"enum", "literal_error"}:
        return "Selecciona una de las opciones permitidas."
    return "Revisa el formato o el valor de este campo."


@app.exception_handler(RequestValidationError)
async def entrada_invalida(_request: Request, error: RequestValidationError) -> JSONResponse:
    campos = [
        ErrorCampo(
            campo=".".join(map(str, item["loc"][1:])) or "solicitud",
            mensaje=mensaje_validacion(item["type"]),
        )
        for item in error.errors()
    ]
    return responder_error(422, "Revisa los datos de la solicitud.", campos=campos)


@app.exception_handler(AlojamientoNoEncontrado)
async def alojamiento_no_encontrado(_request: Request, _error: AlojamientoNoEncontrado) -> JSONResponse:
    return responder_error(404, "Alojamiento no encontrado.")


@app.exception_handler(ConexionSqlError)
async def sql_no_disponible(_request: Request, error: ConexionSqlError) -> JSONResponse:
    logger.warning("%s", error)
    return responder_error(503, "SQL Server no está disponible para esta operación.")


@app.get("/", include_in_schema=False)
def inicio() -> RedirectResponse:
    return RedirectResponse("/docs")


class Salud(BaseModel):
    model_config = ConfigDict(json_schema_extra={
        "examples": [{"estado": "ok", "origen": "sqlserver", "base": "BD_ROOMI"}],
    })
    estado: Literal["ok"]
    origen: Literal["sqlserver"]
    base: str


@app.get(
    "/api/salud", tags=["Sistema"],
    summary="Comprobar la disponibilidad de la API",
    description="Comprueba la conexión a SQL Server y la presencia del esquema requerido.",
)
def salud() -> Salud:
    with abrir_conexion() as conexion:
        base, tablas, eliminacion = conexion.cursor().execute("""
            SELECT DB_NAME(), COUNT(*), COL_LENGTH(N'dbo.alojamientos', N'deleted_at')
            FROM sys.tables
            WHERE schema_id = SCHEMA_ID(N'dbo') AND name IN (
                N'alojamientos', N'usuarios', N'moderaciones', N'consultas', N'resenas', N'reportes'
            )
        """).fetchone()
    if tablas != 6:
        raise HTTPException(503, "Faltan tablas del esquema de ROOMI.")
    if eliminacion is None:
        raise HTTPException(503, "Actualiza el esquema de ROOMI con las migraciones.")
    return Salud(estado="ok", origen="sqlserver", base=base)

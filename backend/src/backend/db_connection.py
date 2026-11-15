from collections.abc import Iterator
from contextlib import contextmanager
import os
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pyodbc import Connection


class ConexionSqlError(RuntimeError):
    """SQL Server no está disponible o falta su configuración."""


def _valor_odbc(valor: str) -> str:
    return "{" + valor.replace("}", "}}") + "}"


def _cadena_conexion() -> str:
    cadena = os.getenv("ROOMI_SQLSERVER_CONNECTION_STRING", "").strip()
    if cadena:
        return cadena

    host = os.getenv("DB_HOST", "").strip()
    base = os.getenv("DB_NAME", "").strip()
    driver = os.getenv("DB_DRIVER", "ODBC Driver 18 for SQL Server").strip()
    if not all((host, base, driver)):
        raise ConexionSqlError("Configura DB_HOST, DB_NAME y DB_DRIVER en el backend.")

    usuario = os.getenv("DB_USER", "").strip()
    password = os.getenv("DB_PASSWORD", "")
    if bool(usuario) != bool(password):
        raise ConexionSqlError("Completa DB_USER y DB_PASSWORD o deja ambos vacíos.")

    confiar = os.getenv("DB_TRUST_SERVER_CERTIFICATE", "no").strip().lower()
    if confiar not in ("yes", "no"):
        raise ConexionSqlError("DB_TRUST_SERVER_CERTIFICATE debe ser yes o no.")

    opciones = [
        f"Driver={_valor_odbc(driver)}",
        f"Server={_valor_odbc(host)}",
        f"Database={_valor_odbc(base)}",
        "Encrypt=yes",
        f"TrustServerCertificate={confiar}",
    ]
    if usuario:
        opciones.extend((f"UID={_valor_odbc(usuario)}", f"PWD={_valor_odbc(password)}"))
    else:
        opciones.append("Trusted_Connection=yes")
    return ";".join(opciones) + ";"


@contextmanager
def abrir_conexion() -> Iterator["Connection"]:
    cadena = _cadena_conexion()

    try:
        import pyodbc
    except ImportError as error:
        raise ConexionSqlError("Instala el extra sqlserver para usar SQL Server.") from error

    try:
        conexion = pyodbc.connect(cadena, timeout=5)
        try:
            yield conexion
        finally:
            conexion.close()
    except pyodbc.Error as error:
        raise ConexionSqlError("No se pudo completar la operación en SQL Server.") from error

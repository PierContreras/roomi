from collections.abc import Iterator
from contextlib import contextmanager
import os
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pyodbc import Connection


class ConexionSqlError(RuntimeError):
    """SQL Server no está disponible o falta su configuración."""


@contextmanager
def abrir_conexion() -> Iterator["Connection"]:
    cadena = os.environ.get("ROOMI_SQLSERVER_CONNECTION_STRING", "").strip()
    if not cadena:
        raise ConexionSqlError("Configura ROOMI_SQLSERVER_CONNECTION_STRING.")

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

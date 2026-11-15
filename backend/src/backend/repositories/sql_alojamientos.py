import json

from backend.db_connection import ConexionSqlError, abrir_conexion
from backend.schemas.alojamiento import Alojamiento

CONSULTA_PUBLICADOS = """
    SELECT id, title, zone, university, [type] AS [type], price, deposit,
           minutes, amenities_json, description, rules, address, photos_json, [owner] AS [owner]
    FROM dbo.alojamientos
    WHERE [status] = ?
"""


class RepositorioAlojamientosSql:
    def listar_publicados(self) -> list[Alojamiento]:
        return self._consultar(CONSULTA_PUBLICADOS + " ORDER BY id", "approved")

    def buscar_publicado(self, anuncio_id: str) -> Alojamiento | None:
        filas = self._consultar(CONSULTA_PUBLICADOS + " AND id = ?", "approved", anuncio_id)
        return filas[0] if filas else None

    def _consultar(self, consulta: str, *parametros: str) -> list[Alojamiento]:
        with abrir_conexion() as conexion:
            cursor = conexion.cursor()
            cursor.execute(consulta, *parametros)
            columnas = [columna[0] for columna in cursor.description]
            filas = cursor.fetchall()

        try:
            alojamientos = []
            for fila in filas:
                datos = dict(zip(columnas, fila, strict=True))
                datos["amenities"] = json.loads(datos.pop("amenities_json"))
                datos["photos"] = json.loads(datos.pop("photos_json"))
                alojamientos.append(Alojamiento.model_validate(datos))
            return alojamientos
        except ValueError as error:
            raise ConexionSqlError("Los datos de alojamientos no cumplen el esquema esperado.") from error

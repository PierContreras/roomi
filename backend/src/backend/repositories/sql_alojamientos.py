import json

from backend.db_connection import ConexionSqlError, abrir_conexion
from backend.schemas.alojamiento import Alojamiento

CAMPOS_CATALOGO = """
    a.id, a.title, a.zone, a.university, a.[type], a.price, a.deposit, a.minutes,
    a.description, a.rules, a.address, a.latitude, a.longitude, a.distance_km AS distanceKm, a.whatsapp,
    COALESCE((SELECT u.name FROM dbo.usuarios u WHERE u.id=a.owner_id),
        (SELECT h.nombre FROM dbo.alojamiento_titular_historico h WHERE h.alojamiento_id=a.id),
        N'Propietario') AS [owner],
    (SELECT s.servicio FROM dbo.alojamiento_servicios s WHERE s.alojamiento_id=a.id
        ORDER BY s.posicion FOR JSON PATH) AS amenities_json,
    (SELECT f.src, f.alt FROM dbo.alojamiento_fotos f WHERE f.alojamiento_id=a.id
        ORDER BY f.posicion FOR JSON PATH) AS photos_json
"""

CONSULTA_PUBLICADOS = f"""
    SELECT {CAMPOS_CATALOGO}, CAST(CASE WHEN a.owner_id IS NULL THEN 0 ELSE 1 END AS BIT) AS contactAvailable
    FROM dbo.alojamientos a
    WHERE a.[status] = ? AND a.deleted_at IS NULL
"""

def convertir_anuncio(datos, modelo=Alojamiento):
    try:
        datos["amenities"] = [item["servicio"] for item in json.loads(datos.pop("amenities_json") or "[]")]
        datos["photos"] = json.loads(datos.pop("photos_json") or "[]")
        return modelo.model_validate(datos)
    except ValueError as error:
        raise ConexionSqlError("Los datos de alojamientos no cumplen el esquema esperado.") from error


class RepositorioAlojamientosSql:
    def listar_publicados(self) -> list[Alojamiento]:
        return self._consultar(CONSULTA_PUBLICADOS + """
            ORDER BY (SELECT MAX(d.fecha) FROM dbo.decisiones_moderacion d
                WHERE d.anuncio_id=a.id AND d.accion='aprobar') DESC, a.id
        """, "publicado")

    def buscar_publicado(self, anuncio_id: str) -> Alojamiento | None:
        filas = self._consultar(CONSULTA_PUBLICADOS + " AND id = ?", "publicado", anuncio_id)
        return filas[0] if filas else None

    def _consultar(self, consulta: str, *parametros: str) -> list[Alojamiento]:
        with abrir_conexion() as conexion:
            cursor = conexion.cursor()
            cursor.execute(consulta, *parametros)
            columnas = [columna[0] for columna in cursor.description]
            filas = cursor.fetchall()

        return [convertir_anuncio(dict(zip(columnas, fila, strict=True))) for fila in filas]

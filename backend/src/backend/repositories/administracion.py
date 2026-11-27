from backend.db_connection import abrir_conexion
from backend.repositories.gestion import auditar, consultar
from backend.schemas.gestion import SeccionAdministracion
from backend.services.exceptions import ModeracionNoEncontrada


# Cada sección declara sus columnas y el orden. La búsqueda se envía como parámetro.
LISTADOS: dict[SeccionAdministracion, tuple[str, str, str]] = {
    "usuarios": (
        """
        SELECT u.id, u.name AS nombre, u.email AS correo, r.nombre AS rol,
               (SELECT COUNT(*) FROM dbo.alojamientos a WHERE a.owner_id=u.id AND a.deleted_at IS NULL) AS anuncios
        FROM dbo.usuarios u JOIN dbo.roles r ON r.id=u.rol_id
        """,
        "CONCAT_WS(N' ', u.name, u.email, r.nombre, u.id)", "u.name, u.id",
    ),
    "anuncios": (
        """
        SELECT a.id, a.title AS titulo, a.zone AS zona, a.university AS universidad,
               a.[type] AS tipo, CAST(a.price AS VARCHAR(20)) AS precio,
               CAST(a.deposit AS VARCHAR(20)) AS garantia,
               CASE WHEN a.deleted_at IS NOT NULL THEN N'Eliminado'
                    WHEN a.ocupado=1 AND a.[status]='publicado' THEN N'Ocupado'
                    WHEN a.[status]='en_revision' THEN N'En revisión'
                    WHEN a.[status]='publicado' THEN N'Publicado'
                    WHEN a.[status]='borrador' THEN N'Borrador'
                    WHEN a.[status]='retirado' THEN N'Retirado'
                    ELSE N'Rechazado' END AS estado,
               COALESCE(u.name, h.nombre) AS titular, a.address AS direccion,
               a.description AS descripcion, a.rules AS reglas,
               (SELECT COUNT(*) FROM dbo.alojamiento_fotos f WHERE f.alojamiento_id=a.id) AS fotos
        FROM dbo.alojamientos a
        LEFT JOIN dbo.usuarios u ON u.id=a.owner_id
        LEFT JOIN dbo.alojamiento_titular_historico h ON h.alojamiento_id=a.id
        """,
        "CONCAT_WS(N' ', a.title, a.zone, a.university, u.name, h.nombre, a.[status], a.id)",
        "CASE WHEN a.deleted_at IS NULL THEN 0 ELSE 1 END, a.title, a.id",
    ),
    "reportes": (
        """
        SELECT p.id, a.title AS anuncio, u.name AS autor, p.message AS mensaje,
               IIF(p.resuelto_fecha IS NULL, N'Pendiente', N'Resuelto') AS estado,
               CONVERT(VARCHAR(19), p.created_at, 126) + 'Z' AS fecha,
               CONVERT(VARCHAR(19), p.resuelto_fecha, 126) + 'Z' AS fechaResolucion
        FROM dbo.reportes p
        JOIN dbo.alojamientos a ON a.id=p.alojamiento_id
        JOIN dbo.usuarios u ON u.id=p.student_id
        """,
        "CONCAT_WS(N' ', a.title, u.name, p.message, IIF(p.resuelto_fecha IS NULL, N'Pendiente', N'Resuelto'))",
        "CASE WHEN p.resuelto_fecha IS NULL THEN 0 ELSE 1 END, p.created_at DESC, p.id",
    ),
    "resenas": (
        """
        SELECT v.id, a.title AS anuncio, u.name AS autor, CAST(v.rating AS INT) AS calificacion,
               v.message AS mensaje, CONVERT(VARCHAR(19), v.created_at, 126) + 'Z' AS fecha
        FROM dbo.resenas v
        JOIN dbo.alojamientos a ON a.id=v.alojamiento_id
        JOIN dbo.usuarios u ON u.id=v.student_id
        """,
        "CONCAT_WS(N' ', a.title, u.name, v.message)", "v.created_at DESC, v.id",
    ),
    "consultas": (
        """
        SELECT c.id, a.title AS anuncio, c.name AS autor, c.email AS correo,
               c.whatsapp, c.message AS mensaje,
               IIF(c.respondida_fecha IS NULL, N'Pendiente', N'Respondida') AS estado,
               CONVERT(VARCHAR(19), c.created_at, 126) + 'Z' AS fecha,
               CONVERT(VARCHAR(19), c.respondida_fecha, 126) + 'Z' AS fechaRespuesta
        FROM dbo.consultas c JOIN dbo.alojamientos a ON a.id=c.alojamiento_id
        """,
        "CONCAT_WS(N' ', a.title, c.name, c.email, c.message, IIF(c.respondida_fecha IS NULL, N'Pendiente', N'Respondida'))",
        "c.created_at DESC, c.id",
    ),
    "moderacion": (
        """
        SELECT d.id, a.title AS anuncio, d.accion, d.motivo, u.name AS responsable,
               CONVERT(VARCHAR(19), d.fecha, 126) + 'Z' AS fecha
        FROM dbo.decisiones_moderacion d
        JOIN dbo.alojamientos a ON a.id=d.anuncio_id
        LEFT JOIN dbo.usuarios u ON u.id=d.responsable_id
        """,
        "CONCAT_WS(N' ', a.title, d.accion, d.motivo, u.name)", "d.fecha DESC, d.id",
    ),
}


def listar(seccion: SeccionAdministracion, buscar: str, pagina: int, tamano: int):
    consulta, campos, orden = LISTADOS[seccion]
    filtro = f"WHERE CHARINDEX(?, {campos} COLLATE Latin1_General_100_CI_AI) > 0" if buscar else ""
    parametros = (buscar,) if buscar else ()
    filas = consultar(f"""
        {consulta}
        {filtro}
        ORDER BY {orden} OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
    """, *parametros, (pagina - 1) * tamano, tamano + 1)
    return {"registros": filas[:tamano], "haySiguiente": len(filas) > tamano}


def eliminar_anuncio(anuncio_id: str, administrador_id: str, motivo: str) -> None:
    with abrir_conexion() as conexion:
        cursor = conexion.cursor().execute("""
            UPDATE dbo.alojamientos SET deleted_at=SYSUTCDATETIME()
            WHERE id=? AND deleted_at IS NULL
        """, anuncio_id)
        if not cursor.rowcount:
            raise ModeracionNoEncontrada
        auditar(cursor, anuncio_id, administrador_id, "eliminar", motivo)
        conexion.commit()

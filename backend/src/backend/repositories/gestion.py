from uuid import uuid4

from backend.db_connection import abrir_conexion
from backend.repositories.sql_alojamientos import CAMPOS_CATALOGO, convertir_anuncio
from backend.schemas.gestion import AnuncioGestionado, Borrador, Consulta, Resena, ResultadoAnuncio
from backend.services.archivos_fotos import es_ruta_foto, guardar_foto
from backend.services.exceptions import (
    ModeracionNoEncontrada, PublicacionInvalida, ResenaPropiaNoPermitida, TransicionInvalida,
)
from backend.services.moderacion_reglas import validar_publicacion

CAMPOS = f"""
    {CAMPOS_CATALOGO}, a.owner_id AS ownerId, a.ocupado,
    CASE WHEN a.[status] IN ('en_revision', 'rechazado') THEN 'borrador' ELSE a.[status] END AS [status]
"""

def consultar(sql: str, *params):
    with abrir_conexion() as conn:
        cursor = conn.cursor().execute(sql, *params)
        names = [column[0] for column in cursor.description]
        return [dict(zip(names, row, strict=True)) for row in cursor.fetchall()]


def usuario(valor: str, por_correo: bool = False):
    campo = "email" if por_correo else "id"
    filas = consultar(f"""
        SELECT u.id, u.name, u.email, r.codigo AS role, u.password_hash
        FROM dbo.usuarios u JOIN dbo.roles r ON r.id=u.rol_id WHERE u.{campo}=?
    """, valor)
    return filas[0] if filas else None


def inscribir(name: str, email: str, role: str, password_hash: str):
    user_id = str(uuid4())
    with abrir_conexion() as conn:
        cursor = conn.cursor().execute("""
            INSERT INTO dbo.usuarios (id, name, email, rol_id, password_hash)
            SELECT ?, ?, ?, r.id, ? FROM dbo.roles r WHERE r.codigo=?
              AND NOT EXISTS (SELECT 1 FROM dbo.usuarios WITH (UPDLOCK, HOLDLOCK) WHERE email = ?)
        """, user_id, name, email, password_hash, role, email)
        if not cursor.rowcount:
            return None
        conn.commit()
    return {"id": user_id, "name": name, "email": email, "role": role}


def resumen_administracion():
    return consultar("""
        SELECT (SELECT COUNT(*) FROM dbo.usuarios) AS usuarios,
               (SELECT COUNT(*) FROM dbo.alojamientos WHERE deleted_at IS NULL AND [status]='publicado') AS anunciosPublicados,
               (SELECT COUNT(*) FROM dbo.reportes WHERE resuelto_fecha IS NULL) AS reportesPendientes
    """)[0]


def actualizar_hash(user_id: str, anterior: str, nuevo: str) -> None:
    with abrir_conexion() as conn:
        conn.cursor().execute("""
            UPDATE dbo.usuarios SET password_hash = ? WHERE id = ? AND password_hash = ?
        """, nuevo, user_id, anterior)
        conn.commit()


def convertir_gestion(row):
    return convertir_anuncio(row, AnuncioGestionado)


def anuncios(owner_id: str):
    filas = consultar(
        f"SELECT {CAMPOS} FROM dbo.alojamientos a WHERE owner_id=? AND deleted_at IS NULL ORDER BY id",
        owner_id,
    )
    return [convertir_gestion(row) for row in filas]


def anuncio_propio(anuncio_id: str, owner_id: str) -> AnuncioGestionado | None:
    filas = consultar(
        f"SELECT {CAMPOS} FROM dbo.alojamientos a WHERE id=? AND owner_id=? AND deleted_at IS NULL",
        anuncio_id, owner_id,
    )
    return convertir_gestion(filas[0]) if filas else None


def bloquear_propietario(cursor, owner_id):
    if not cursor.execute("SELECT id FROM dbo.usuarios WITH (UPDLOCK, HOLDLOCK) WHERE id=?", owner_id).fetchone():
        raise ModeracionNoEncontrada


def seleccionar_anuncio(cursor, anuncio_id, owner_id):
    cursor.execute(f"""
        SELECT {CAMPOS} FROM dbo.alojamientos a WITH (UPDLOCK)
        WHERE id=? AND deleted_at IS NULL AND owner_id=?
    """, anuncio_id, owner_id)
    row = cursor.fetchone()
    if row is None:
        raise ModeracionNoEncontrada
    return convertir_gestion(dict(zip((col[0] for col in cursor.description), row, strict=True)))


def auditar(cursor, anuncio_id, responsable, accion, motivo):
    cursor.execute("""
        INSERT dbo.decisiones_moderacion (id, anuncio_id, accion, motivo, responsable_id)
        VALUES (?, ?, ?, ?, ?)
    """, str(uuid4()), anuncio_id, accion, motivo, responsable)


def cambiar_estado(cursor, anuncio_id, estado):
    cursor.execute("""
        UPDATE dbo.alojamientos SET [status]=?, motivos_revision=N'[]', review_note=NULL,
            revision=revision+1, ocupado=CASE WHEN ?='publicado' THEN 0 ELSE ocupado END WHERE id=?
    """, estado, estado, anuncio_id)


def guardar(data: Borrador, owner, anuncio_id: str | None = None, *, borrador=False):
    values = (
        data.title, data.zone, data.university, data.type, data.price, data.deposit,
        data.minutes, data.description,
        data.rules, data.address,
        data.latitude, data.longitude, data.distanceKm, data.whatsapp,
    )
    with abrir_conexion() as conn:
        cursor = conn.cursor()
        bloquear_propietario(cursor, owner.id)
        actual = seleccionar_anuncio(cursor, anuncio_id, owner.id) if anuncio_id else None
        rutas_actuales = {foto.src for foto in actual.photos} if actual else set()
        if any(es_ruta_foto(foto.src) and foto.src not in rutas_actuales for foto in data.photos):
            raise PublicacionInvalida("La foto guardada no pertenece a este anuncio.")
        if actual and borrador and actual.status != "borrador":
            raise TransicionInvalida
        if borrador or (actual and actual.status == "borrador"):
            estado = "borrador"
        elif actual and actual.status == "retirado":
            estado = "retirado"
        else:
            validar_publicacion(data)
            estado = "publicado"
        if anuncio_id:
            cursor.execute("""
                UPDATE dbo.alojamientos SET title=?, zone=?, university=?, [type]=?, price=?,
                    deposit=?, minutes=?, description=?, rules=?, address=?,
                    latitude=?, longitude=?, distance_km=?, whatsapp=?, [status]=?,
                    motivos_revision=N'[]', review_note=NULL, revision=revision+1 WHERE id=?
            """, *values, estado, anuncio_id)
        else:
            anuncio_id = str(uuid4())
            cursor.execute("""
                INSERT dbo.alojamientos (title, zone, university, [type], price, deposit, minutes,
                    description, rules, address, latitude, longitude,
                    distance_km, whatsapp, id, owner_id, [status])
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, *values, anuncio_id, owner.id, estado)
        cursor.execute("DELETE FROM dbo.alojamiento_servicios WHERE alojamiento_id=?", anuncio_id)
        cursor.execute("DELETE FROM dbo.alojamiento_fotos WHERE alojamiento_id=?", anuncio_id)
        if data.amenities:
            cursor.executemany("""
                INSERT dbo.alojamiento_servicios (alojamiento_id, servicio, posicion) VALUES (?, ?, ?)
            """, [(anuncio_id, servicio, posicion) for posicion, servicio in enumerate(dict.fromkeys(data.amenities))])
        if data.photos:
            cursor.executemany("""
                INSERT dbo.alojamiento_fotos (alojamiento_id, posicion, src, alt) VALUES (?, ?, ?, ?)
            """, [(anuncio_id, posicion, guardar_foto(foto.src), foto.alt) for posicion, foto in enumerate(data.photos)])
        if estado == "publicado":
            auditar(cursor, anuncio_id, owner.id, "aprobar", "publicacion_automatica")
        conn.commit()
    return ResultadoAnuncio(id=anuncio_id, status=estado)


def enviar(anuncio_id, owner_id, origen):
    with abrir_conexion() as conn:
        cursor = conn.cursor()
        bloquear_propietario(cursor, owner_id)
        anuncio = seleccionar_anuncio(cursor, anuncio_id, owner_id)
        if anuncio.status != origen:
            raise TransicionInvalida
        validar_publicacion(anuncio)
        cambiar_estado(cursor, anuncio_id, "publicado")
        auditar(cursor, anuncio_id, owner_id, "aprobar", "publicacion_automatica")
        conn.commit()
    return ResultadoAnuncio(id=anuncio_id, status="publicado")


def retirar(anuncio_id: str, owner_id: str):
    with abrir_conexion() as conn:
        cursor = conn.cursor()
        anuncio = seleccionar_anuncio(cursor, anuncio_id, owner_id)
        if anuncio.status != "publicado":
            raise TransicionInvalida
        cambiar_estado(cursor, anuncio_id, "retirado")
        auditar(cursor, anuncio_id, owner_id, "retirar", "retiro_por_titular")
        conn.commit()


def cambiar_disponibilidad(anuncio_id: str, owner_id: str, ocupado: bool):
    with abrir_conexion() as conn:
        cursor = conn.cursor()
        anuncio = seleccionar_anuncio(cursor, anuncio_id, owner_id)
        if anuncio.status != "publicado":
            raise TransicionInvalida
        cursor.execute("UPDATE dbo.alojamientos SET ocupado=? WHERE id=?", ocupado, anuncio_id)
        conn.commit()


def eliminar(anuncio_id: str, owner_id: str):
    with abrir_conexion() as conn:
        cursor = conn.cursor()
        seleccionar_anuncio(cursor, anuncio_id, owner_id)
        cursor.execute("UPDATE dbo.alojamientos SET deleted_at=SYSUTCDATETIME() WHERE id=?", anuncio_id)
        auditar(cursor, anuncio_id, owner_id, "eliminar", "eliminacion_por_titular")
        conn.commit()


def enviar_consulta(anuncio_id: str, data: Consulta):
    item_id = str(uuid4())
    with abrir_conexion() as conn:
        cursor = conn.cursor().execute("""
            INSERT dbo.consultas (id, alojamiento_id, name, whatsapp, email, message)
            SELECT ?, id, ?, ?, ?, ? FROM dbo.alojamientos WITH (UPDLOCK)
            WHERE id=? AND [status]='publicado' AND deleted_at IS NULL AND ocupado=0 AND owner_id IS NOT NULL
        """, item_id, data.name, data.whatsapp, data.email, data.message, anuncio_id)
        if not cursor.rowcount:
            return None
        conn.commit()
    return item_id


def consultar_bandeja(owner_id: str):
    return consultar("""
        SELECT c.id, a.id AS roomId, a.title, c.name, c.whatsapp, c.email, c.message,
            CONVERT(varchar(33), c.created_at, 126) + 'Z' AS creadaEn,
            CONVERT(varchar(33), c.respondida_fecha, 126) + 'Z' AS respondidaEn
        FROM dbo.consultas AS c JOIN dbo.alojamientos AS a ON a.id = c.alojamiento_id
        WHERE a.owner_id = ? ORDER BY c.created_at DESC, c.id
    """, owner_id)


def actualizar_consulta(consulta_id: str, owner_id: str, respondida: bool):
    with abrir_conexion() as conn:
        cursor = conn.cursor().execute("""
            UPDATE c SET respondida_fecha=CASE WHEN ?=1
                THEN COALESCE(c.respondida_fecha, SYSUTCDATETIME()) ELSE NULL END
            FROM dbo.consultas c JOIN dbo.alojamientos a ON a.id=c.alojamiento_id
            WHERE c.id=? AND a.owner_id=?
        """, respondida, consulta_id, owner_id)
        if not cursor.rowcount:
            raise ModeracionNoEncontrada
        conn.commit()


def resenas(anuncio_id: str):
    return consultar("""
        SELECT r.id, u.name, r.rating, r.message FROM dbo.resenas AS r
        JOIN dbo.usuarios AS u ON r.student_id = u.id
        JOIN dbo.alojamientos AS a ON r.alojamiento_id = a.id
        WHERE a.id = ? AND a.[status] = 'publicado' AND a.deleted_at IS NULL AND a.ocupado=0 ORDER BY r.created_at DESC, r.id
    """, anuncio_id)


def agregar_interaccion(anuncio_id: str, student_id: str, data):
    tabla = "resenas" if isinstance(data, Resena) else "reportes"
    rating_column = ", rating" if tabla == "resenas" else ""
    rating_value = ", ?" if tabla == "resenas" else ""
    item_id = str(uuid4())
    params = (item_id, student_id, data.message)
    if isinstance(data, Resena):
        params += (data.rating,)
    with abrir_conexion() as conn:
        cursor = conn.cursor()
        anuncio = cursor.execute("""
            SELECT owner_id FROM dbo.alojamientos WITH (UPDLOCK) WHERE id=? AND [status]='publicado' AND deleted_at IS NULL AND ocupado=0
        """, anuncio_id).fetchone()
        if anuncio is None:
            return None
        if isinstance(data, Resena) and str(anuncio[0]).lower() == student_id.lower():
            raise ResenaPropiaNoPermitida
        cursor.execute(f"""
            INSERT dbo.{tabla} (id, alojamiento_id, student_id, message{rating_column})
            SELECT ?, ?, ?, ?{rating_value}
            WHERE NOT EXISTS (
                SELECT 1 FROM dbo.{tabla} WITH (UPDLOCK, HOLDLOCK)
                WHERE alojamiento_id=? AND student_id=?
            )
        """, params[0], anuncio_id, *params[1:], anuncio_id, student_id)
        if not cursor.rowcount:
            return ""
        conn.commit()
    return item_id

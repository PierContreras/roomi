import json
from uuid import uuid4

from backend.db_connection import abrir_conexion
from backend.repositories.sql_alojamientos import CAMPOS_CATALOGO, convertir_anuncio
from backend.schemas.gestion import AnuncioGestionado, Borrador, Consulta, Decision, Resena, ResultadoAnuncio
from backend.services.exceptions import (
    ConflictoDeInteres, ModeracionNoEncontrada, ResenaPropiaNoPermitida, TransicionInvalida,
)
from backend.services.moderacion_reglas import evaluar

CAMPOS = f"""
    {CAMPOS_CATALOGO}, a.[status], a.owner_id AS ownerId,
    a.review_note AS reviewNote, a.motivos_revision, a.revision
"""

def consultar(sql: str, *params):
    with abrir_conexion() as conn:
        cursor = conn.cursor().execute(sql, *params)
        names = [column[0] for column in cursor.description]
        return [dict(zip(names, row, strict=True)) for row in cursor.fetchall()]


def usuario(valor: str, por_correo: bool = False):
    campo = "email" if por_correo else "id"
    filas = consultar(f"SELECT id, name, email, role, password_hash FROM dbo.usuarios WHERE {campo} = ?", valor)
    return filas[0] if filas else None


def inscribir(name: str, email: str, role: str, password_hash: str):
    user_id = str(uuid4())
    with abrir_conexion() as conn:
        cursor = conn.cursor().execute("""
            INSERT INTO dbo.usuarios (id, name, email, role, password_hash)
            SELECT ?, ?, ?, ?, ?
            WHERE NOT EXISTS (SELECT 1 FROM dbo.usuarios WITH (UPDLOCK, HOLDLOCK) WHERE email = ?)
        """, user_id, name, email, role, password_hash, email)
        if not cursor.rowcount:
            return None
        conn.commit()
    return {"id": user_id, "name": name, "email": email, "role": role}


def actualizar_hash(user_id: str, anterior: str, nuevo: str) -> None:
    with abrir_conexion() as conn:
        conn.cursor().execute("""
            UPDATE dbo.usuarios SET password_hash = ? WHERE id = ? AND password_hash = ?
        """, nuevo, user_id, anterior)
        conn.commit()


def convertir_gestion(row):
    row["motivos"] = json.loads(row.pop("motivos_revision"))
    return convertir_anuncio(row, AnuncioGestionado)


def anuncios(owner_id: str | None = None):
    sql = f"SELECT {CAMPOS} FROM dbo.alojamientos a"
    if owner_id:
        filas = consultar(sql + " WHERE owner_id = ? AND deleted_at IS NULL ORDER BY id", owner_id)
    else:
        filas = consultar(sql + " WHERE [status] = 'en_revision' AND deleted_at IS NULL ORDER BY id")
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


def seleccionar_anuncio(cursor, anuncio_id, owner_id=None):
    sql = f"SELECT {CAMPOS} FROM dbo.alojamientos a WITH (UPDLOCK) WHERE id=? AND deleted_at IS NULL"
    parametros = [anuncio_id]
    if owner_id is not None:
        sql += " AND owner_id=?"
        parametros.append(owner_id)
    cursor.execute(sql, *parametros)
    row = cursor.fetchone()
    if row is None:
        raise ModeracionNoEncontrada
    return convertir_gestion(dict(zip((col[0] for col in cursor.description), row, strict=True)))


def motivos_para(cursor, data, owner_id):
    suspendido, reportes_abiertos = cursor.execute("""
        SELECT
            CASE WHEN EXISTS (SELECT 1 FROM dbo.suspensiones_propietario
                WHERE propietario_id=? AND levantada_fecha IS NULL) THEN 1 ELSE 0 END,
            CASE WHEN EXISTS (SELECT 1 FROM dbo.reportes r JOIN dbo.alojamientos a
                ON a.id=r.alojamiento_id WHERE a.owner_id=? AND r.resuelto_fecha IS NULL)
                THEN 1 ELSE 0 END
    """, owner_id, owner_id).fetchone()
    return evaluar(data, suspendido=bool(suspendido), reportes_abiertos=bool(reportes_abiertos))


def auditar(cursor, anuncio_id, responsable, accion, motivo):
    cursor.execute("""
        INSERT dbo.decisiones_moderacion (id, anuncio_id, accion, motivo, responsable_id)
        VALUES (?, ?, ?, ?, ?)
    """, str(uuid4()), anuncio_id, accion, motivo, responsable)


def registrar_evaluacion(cursor, anuncio_id, responsable, estado, motivos):
    if estado == "publicado":
        auditar(cursor, anuncio_id, responsable, "aprobar", "publicacion_automatica")
    elif estado == "en_revision":
        auditar(cursor, anuncio_id, responsable, "enviar_revision", json.dumps(motivos))


def cambiar_estado(cursor, anuncio_id, responsable, estado, motivos):
    cursor.execute("""
        UPDATE dbo.alojamientos SET [status]=?, motivos_revision=?, review_note=NULL,
            revision=revision+1 WHERE id=?
    """, estado, json.dumps(motivos), anuncio_id)
    registrar_evaluacion(cursor, anuncio_id, responsable, estado, motivos)
    return ResultadoAnuncio(id=anuncio_id, status=estado, motivos=motivos)


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
        if actual and borrador and actual.status != "borrador":
            raise TransicionInvalida
        if borrador or (actual and actual.status == "borrador"):
            estado, motivos = "borrador", []
        elif actual and actual.status == "retirado":
            estado, motivos = "retirado", []
        else:
            motivos = motivos_para(cursor, data, owner.id)
            if actual and actual.status in ("rechazado", "en_revision"):
                motivos.append("cambios_para_revision")
            estado = "en_revision" if motivos else "publicado"
        if anuncio_id:
            cursor.execute("""
                UPDATE dbo.alojamientos SET title=?, zone=?, university=?, [type]=?, price=?,
                    deposit=?, minutes=?, description=?, rules=?, address=?,
                    latitude=?, longitude=?, distance_km=?, whatsapp=?, [status]=?,
                    motivos_revision=?, review_note=NULL, revision=revision+1 WHERE id=?
            """, *values, estado, json.dumps(motivos), anuncio_id)
        else:
            anuncio_id = str(uuid4())
            cursor.execute("""
                INSERT dbo.alojamientos (title, zone, university, [type], price, deposit, minutes,
                    description, rules, address, latitude, longitude,
                    distance_km, whatsapp, id, owner_id, [status], motivos_revision)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, *values, anuncio_id, owner.id, estado, json.dumps(motivos))
        cursor.execute("DELETE FROM dbo.alojamiento_servicios WHERE alojamiento_id=?", anuncio_id)
        cursor.execute("DELETE FROM dbo.alojamiento_fotos WHERE alojamiento_id=?", anuncio_id)
        if data.amenities:
            cursor.executemany("""
                INSERT dbo.alojamiento_servicios (alojamiento_id, servicio, posicion) VALUES (?, ?, ?)
            """, [(anuncio_id, servicio, posicion) for posicion, servicio in enumerate(dict.fromkeys(data.amenities))])
        if data.photos:
            cursor.executemany("""
                INSERT dbo.alojamiento_fotos (alojamiento_id, posicion, src, alt) VALUES (?, ?, ?, ?)
            """, [(anuncio_id, posicion, foto.src, foto.alt) for posicion, foto in enumerate(data.photos)])
        registrar_evaluacion(cursor, anuncio_id, owner.id, estado, motivos)
        conn.commit()
    return ResultadoAnuncio(id=anuncio_id, status=estado, motivos=motivos)


def enviar(anuncio_id, owner_id, origen):
    with abrir_conexion() as conn:
        cursor = conn.cursor()
        bloquear_propietario(cursor, owner_id)
        anuncio = seleccionar_anuncio(cursor, anuncio_id, owner_id)
        if anuncio.status != origen:
            raise TransicionInvalida
        motivos = motivos_para(cursor, anuncio, owner_id)
        resultado = cambiar_estado(cursor, anuncio_id, owner_id, "en_revision" if motivos else "publicado", motivos)
        conn.commit()
    return resultado


def retirar(anuncio_id: str, owner_id: str):
    with abrir_conexion() as conn:
        cursor = conn.cursor()
        anuncio = seleccionar_anuncio(cursor, anuncio_id, owner_id)
        if anuncio.status != "publicado":
            raise TransicionInvalida
        cambiar_estado(cursor, anuncio_id, owner_id, "retirado", [])
        auditar(cursor, anuncio_id, owner_id, "retirar", "retiro_por_titular")
        conn.commit()


def eliminar(anuncio_id: str, owner_id: str):
    with abrir_conexion() as conn:
        cursor = conn.cursor()
        seleccionar_anuncio(cursor, anuncio_id, owner_id)
        cursor.execute("UPDATE dbo.alojamientos SET deleted_at=SYSUTCDATETIME() WHERE id=?", anuncio_id)
        auditar(cursor, anuncio_id, owner_id, "eliminar", "eliminacion_por_titular")
        conn.commit()


def moderar(anuncio_id: str, admin_id: str, data: Decision):
    with abrir_conexion() as conn:
        cursor = conn.cursor()
        dueños = cursor.execute("SELECT owner_id FROM dbo.alojamientos WHERE id=?", anuncio_id).fetchone()
        if dueños and dueños[0]:
            bloquear_propietario(cursor, dueños[0])
        anuncio = seleccionar_anuncio(cursor, anuncio_id)
        if (anuncio.ownerId or "").lower() == admin_id.lower():
            raise ConflictoDeInteres
        if anuncio.status != "en_revision" or anuncio.revision != data.revision:
            raise TransicionInvalida
        if data.status == "publicado" and anuncio.ownerId and cursor.execute("""
            SELECT 1 FROM dbo.suspensiones_propietario WHERE propietario_id=? AND levantada_fecha IS NULL
        """, anuncio.ownerId).fetchone():
            raise TransicionInvalida
        cursor.execute("""
            UPDATE dbo.alojamientos SET [status]=?, review_note=?, motivos_revision=N'[]', revision=revision+1
            WHERE id=?
        """, data.status, data.note if data.status == "rechazado" else None, anuncio_id)
        cursor.execute("UPDATE dbo.reportes SET resuelto_fecha=SYSUTCDATETIME() WHERE alojamiento_id=? AND resuelto_fecha IS NULL", anuncio_id)
        auditar(cursor, anuncio_id, admin_id, "aprobar" if data.status == "publicado" else "rechazar", data.note)
        conn.commit()


def suspension(owner_id, admin_id, note, levantar=False):
    with abrir_conexion() as conn:
        cursor = conn.cursor()
        bloquear_propietario(cursor, owner_id)
        if owner_id.lower() == admin_id.lower():
            raise ConflictoDeInteres
        activa = cursor.execute("""
            SELECT id FROM dbo.suspensiones_propietario WHERE propietario_id=? AND levantada_fecha IS NULL
        """, owner_id).fetchone()
        if levantar != bool(activa):
            raise TransicionInvalida
        if levantar:
            cursor.execute("""
                UPDATE dbo.suspensiones_propietario SET levantada_fecha=SYSUTCDATETIME(),
                    levantada_por=?, levantada_motivo=? WHERE id=?
            """, admin_id, note, activa[0])
        else:
            cursor.execute("""
                INSERT dbo.suspensiones_propietario (propietario_id, responsable_id, motivo)
                VALUES (?, ?, ?)
            """, owner_id, admin_id, note)
        afectados = cursor.execute("""
            SELECT id, [status] FROM dbo.alojamientos WITH (UPDLOCK) WHERE owner_id=? AND deleted_at IS NULL
        """, owner_id).fetchall()
        for anuncio_id, estado in afectados:
            if not levantar and estado == "publicado":
                cambiar_estado(cursor, anuncio_id, admin_id, "en_revision", ["propietario_suspendido"])
            auditar(cursor, anuncio_id, admin_id, "levantar_suspension" if levantar else "suspender", note)
        conn.commit()


def historial(anuncio_id):
    if not consultar("SELECT id FROM dbo.alojamientos WHERE id=?", anuncio_id):
        raise ModeracionNoEncontrada
    return consultar("""
        SELECT id, anuncio_id, accion, motivo, responsable_id, fecha FROM dbo.decisiones_moderacion
        WHERE anuncio_id=? ORDER BY fecha, id
    """, anuncio_id)


def crear_admin(email, password_hash):
    with abrir_conexion() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE dbo.usuarios WITH (UPDLOCK, HOLDLOCK) SET role='admin', password_hash=? WHERE email=?
        """, password_hash, email)
        if not cursor.rowcount:
            cursor.execute("""
                INSERT dbo.usuarios (id, name, email, role, password_hash) VALUES (?, ?, ?, 'admin', ?)
            """, str(uuid4()), email[:100], email, password_hash)
        conn.commit()


def enviar_consulta(anuncio_id: str, data: Consulta):
    item_id = str(uuid4())
    with abrir_conexion() as conn:
        cursor = conn.cursor().execute("""
            INSERT dbo.consultas (id, alojamiento_id, name, whatsapp, email, message)
            SELECT ?, id, ?, ?, ?, ? FROM dbo.alojamientos WITH (UPDLOCK)
            WHERE id=? AND [status]='publicado' AND deleted_at IS NULL AND owner_id IS NOT NULL
        """, item_id, data.name, data.whatsapp, data.email, data.message, anuncio_id)
        if not cursor.rowcount:
            return None
        conn.commit()
    return item_id


def consultar_bandeja(owner_id: str):
    return consultar("""
        SELECT c.id, a.id AS roomId, a.title, c.name, c.whatsapp, c.email, c.message
        FROM dbo.consultas AS c JOIN dbo.alojamientos AS a ON a.id = c.alojamiento_id
        WHERE a.owner_id = ? ORDER BY c.created_at DESC, c.id
    """, owner_id)


def resenas(anuncio_id: str):
    return consultar("""
        SELECT r.id, u.name, r.rating, r.message FROM dbo.resenas AS r
        JOIN dbo.usuarios AS u ON r.student_id = u.id
        JOIN dbo.alojamientos AS a ON r.alojamiento_id = a.id
        WHERE a.id = ? AND a.[status] = 'publicado' AND a.deleted_at IS NULL ORDER BY r.created_at DESC, r.id
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
        if tabla == "reportes":
            titular = cursor.execute("SELECT owner_id FROM dbo.alojamientos WHERE id=?", anuncio_id).fetchone()
            if titular and titular[0]:
                bloquear_propietario(cursor, titular[0])
        anuncio = cursor.execute("""
            SELECT owner_id FROM dbo.alojamientos WITH (UPDLOCK) WHERE id=? AND [status]='publicado' AND deleted_at IS NULL
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
        if tabla == "reportes":
            cambiar_estado(cursor, anuncio_id, student_id, "en_revision", ["reporte_recibido"])
        conn.commit()
    return item_id


def reportes():
    return consultar("""
        SELECT r.id, a.id AS roomId, a.title, r.message
        FROM dbo.reportes AS r JOIN dbo.alojamientos AS a ON a.id = r.alojamiento_id
        ORDER BY r.created_at DESC, r.id
    """)

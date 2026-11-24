import json
from uuid import uuid4

from backend.db_connection import abrir_conexion
from backend.repositories.sql_alojamientos import convertir_anuncio
from backend.schemas.gestion import AnuncioGestionado, Borrador, Consulta, Decision, Resena
from backend.services.exceptions import ResenaPropiaNoPermitida

CAMPOS = """
    id, title, zone, university, [type], price, deposit, minutes, amenities_json,
    description, rules, address, photos_json, [owner], [status], owner_id AS ownerId,
    review_note AS reviewNote, revision, latitude, longitude, distance_km AS distanceKm, whatsapp
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


def anuncios(owner_id: str | None = None):
    sql = f"SELECT {CAMPOS} FROM dbo.alojamientos"
    if owner_id:
        filas = consultar(sql + " WHERE owner_id = ? AND deleted_at IS NULL ORDER BY id", owner_id)
    else:
        filas = consultar(sql + " WHERE [status] <> 'withdrawn' ORDER BY id")
    return [convertir_anuncio(row, AnuncioGestionado) for row in filas]


def anuncio_propio(anuncio_id: str, owner_id: str) -> AnuncioGestionado | None:
    filas = consultar(
        f"SELECT {CAMPOS} FROM dbo.alojamientos WHERE id=? AND owner_id=? AND deleted_at IS NULL",
        anuncio_id, owner_id,
    )
    return convertir_anuncio(filas[0], AnuncioGestionado) if filas else None


def guardar(data: Borrador, owner, anuncio_id: str | None = None):
    values = (
        data.title, data.zone, data.university, data.type, data.price, data.deposit,
        data.minutes, json.dumps(data.amenities, ensure_ascii=False), data.description,
        data.rules, data.address, json.dumps([foto.model_dump() for foto in data.photos]),
        data.latitude, data.longitude, data.distanceKm, data.whatsapp,
    )
    with abrir_conexion() as conn:
        cursor = conn.cursor()
        if anuncio_id:
            cursor.execute("""
                UPDATE dbo.alojamientos SET title=?, zone=?, university=?, [type]=?, price=?,
                    deposit=?, minutes=?, amenities_json=?, description=?, rules=?, address=?,
                    photos_json=?, latitude=?, longitude=?, distance_km=?, whatsapp=?, [status]='pending', review_note=NULL, revision=revision+1
                WHERE id=? AND owner_id=? AND deleted_at IS NULL
            """, *values, anuncio_id, owner.id)
            if not cursor.rowcount:
                return None
        else:
            anuncio_id = str(uuid4())
            cursor.execute("""
                INSERT dbo.alojamientos (title, zone, university, [type], price, deposit, minutes,
                    amenities_json, description, rules, address, photos_json, latitude, longitude,
                    distance_km, whatsapp, id, owner_id, [owner], [status])
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
            """, *values, anuncio_id, owner.id, owner.name)
        conn.commit()
    return anuncio_id


def retirar(anuncio_id: str, owner_id: str) -> bool:
    with abrir_conexion() as conn:
        cursor = conn.cursor().execute("""
            UPDATE dbo.alojamientos SET [status]='withdrawn'
            WHERE id=? AND owner_id=? AND [status]<>'withdrawn'
        """, anuncio_id, owner_id)
        changed = cursor.rowcount > 0
        conn.commit()
    return changed


def eliminar(anuncio_id: str, owner_id: str) -> bool:
    with abrir_conexion() as conn:
        cursor = conn.cursor().execute("""
            UPDATE dbo.alojamientos SET [status]='withdrawn', deleted_at=SYSUTCDATETIME()
            WHERE id=? AND owner_id=? AND deleted_at IS NULL
        """, anuncio_id, owner_id)
        changed = cursor.rowcount > 0
        conn.commit()
    return changed


def moderar(anuncio_id: str, admin_id: str, data: Decision) -> bool | None:
    with abrir_conexion() as conn:
        cursor = conn.cursor()
        anuncio = cursor.execute("""
            SELECT [status], revision FROM dbo.alojamientos WITH (UPDLOCK)
            WHERE id=? AND deleted_at IS NULL
        """, anuncio_id).fetchone()
        if anuncio is None:
            return None
        if anuncio[0] != "pending" or anuncio[1] != data.revision:
            return False
        cursor.execute("""
            UPDATE dbo.alojamientos SET [status]=?, review_note=? WHERE id=?
        """, data.status, data.note or None, anuncio_id)
        cursor.execute("""
            INSERT dbo.moderaciones (id, alojamiento_id, admin_id, decision, note) VALUES (?, ?, ?, ?, ?)
        """, str(uuid4()), anuncio_id, admin_id, data.status, data.note or None)
        conn.commit()
    return True


def enviar_consulta(anuncio_id: str, data: Consulta):
    item_id = str(uuid4())
    with abrir_conexion() as conn:
        cursor = conn.cursor().execute("""
            INSERT dbo.consultas (id, alojamiento_id, name, email, message)
            SELECT ?, id, ?, ?, ? FROM dbo.alojamientos WITH (UPDLOCK)
            WHERE id=? AND [status]='approved' AND owner_id IS NOT NULL
        """, item_id, data.name, data.email, data.message, anuncio_id)
        if not cursor.rowcount:
            return None
        conn.commit()
    return item_id


def consultar_bandeja(owner_id: str):
    return consultar("""
        SELECT c.id, a.id AS roomId, a.title, c.name, c.email, c.message
        FROM dbo.consultas AS c JOIN dbo.alojamientos AS a ON a.id = c.alojamiento_id
        WHERE a.owner_id = ? ORDER BY c.created_at DESC, c.id
    """, owner_id)


def resenas(anuncio_id: str):
    return consultar("""
        SELECT r.id, u.name, r.rating, r.message FROM dbo.resenas AS r
        JOIN dbo.usuarios AS u ON r.student_id = u.id
        JOIN dbo.alojamientos AS a ON r.alojamiento_id = a.id
        WHERE a.id = ? AND a.[status] = 'approved' ORDER BY r.created_at DESC, r.id
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
            SELECT owner_id FROM dbo.alojamientos WITH (UPDLOCK) WHERE id=? AND [status]='approved'
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


def reportes():
    return consultar("""
        SELECT r.id, a.id AS roomId, a.title, r.message
        FROM dbo.reportes AS r JOIN dbo.alojamientos AS a ON a.id = r.alojamiento_id
        ORDER BY r.created_at DESC, r.id
    """)

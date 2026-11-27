"""Prueba HTTP y ODBC de ROOMI sobre una base desechable roomi_test."""
import base64
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import ProxyHandler, Request, build_opener

import jwt

from backend.db_connection import abrir_conexion
from backend.repositories.gestion import inscribir, usuario
from backend.services.seguridad import hash_password

ROOT = Path(__file__).resolve().parent
BASE_URL = "http://127.0.0.1:8001"
HTTP = build_opener(ProxyHandler({}))
PHOTO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=="


def request(method, route, code=200, data=None, token=None):
    body = None if data is None else json.dumps(data).encode()
    headers = {"Content-Type": "application/json"} if body else {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = Request(f"{BASE_URL}{route}", data=body, headers=headers, method=method)
    try:
        with HTTP.open(req, timeout=5) as response:
            status, content = response.status, response.read()
            if status == 201 and not route.endswith("/reportes"):
                assert response.headers.get("Location"), f"{method} {route}: falta Location"
    except HTTPError as error:
        status, content = error.code, error.read()
    assert status == code, f"{method} {route}: esperado {code}, recibido {status} ({content.decode(errors='replace')})"
    return json.loads(content) if content else None


def assert_photo(src):
    assert src.startswith("/api/media/alojamientos/") and src.endswith(".png")
    with HTTP.open(f"{BASE_URL}{src}", timeout=5) as response:
        assert response.headers.get_content_type() == "image/png"
        assert response.read() == base64.b64decode(PHOTO.partition(",")[2])


def start():
    process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.main:app", "--app-dir", "src", "--port", "8001"],
        cwd=ROOT,
    )
    try:
        for _ in range(30):
            if process.poll() is not None:
                break
            try:
                health = request("GET", "/api/salud")
                assert health["base"].lower() == "roomi_test"
                return process
            except URLError:
                time.sleep(0.25)
        raise RuntimeError("FastAPI no inició en el puerto 8001.")
    except BaseException:
        stop(process)
        raise


def stop(process):
    process.terminate()
    process.wait(timeout=10)


def main():
    if not os.environ.get("ROOMI_JWT_SECRET"):
        os.environ["ROOMI_JWT_SECRET"] = secrets.token_hex(32)
    os.environ.update(ROOMI_PRECIO_MINIMO="50", ROOMI_PRECIO_MAXIMO="2000", ROOMI_TERMINOS_PROHIBIDOS="")
    with abrir_conexion() as connection:
        base = connection.cursor().execute("SELECT DB_NAME()").fetchone()[0]
        if base.lower() != "roomi_test":
            raise SystemExit("La prueba solo escribe en la base roomi_test.")

    data_key = secrets.token_hex(5)
    password = secrets.token_urlsafe(18)
    owner_email = f"propietario-{data_key}@roomi.test"
    other_email = f"otro-{data_key}@roomi.test"
    print(f"Datos ficticios identificados por {data_key} en roomi_test.", flush=True)
    for name, email in (
        ("Propietario de prueba", owner_email),
        ("Segundo usuario de prueba", other_email),
    ):
        inscribir(name, email, "user", hash_password(password))
    legacy_email = f"anterior-{data_key}@roomi.test"
    admin_email = f"admin-{data_key}@roomi.test"
    inscribir("Administrador de prueba", admin_email, "admin", hash_password(password))
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**15, r=8, p=3, maxmem=64 * 1024**2)
    legacy_hash = f"{salt.hex()}:{digest.hex()}"
    inscribir("Cuenta anterior", legacy_email, "user", legacy_hash)
    process = start()
    try:
        def login(email):
            return request("POST", "/api/auth/login", data={"email": email, "password": password})["token"]

        owner = login(owner_email)
        other = login(other_email)
        registration = {"name": "Estudiante de prueba", "email": f"estudiante-{data_key}@roomi.test", "password": password}
        student = request("POST", "/api/auth/registro", 201, registration)["token"]
        request("POST", "/api/auth/registro", 409, registration)
        assert usuario(f"estudiante-{data_key}@roomi.test", por_correo=True)["password_hash"].startswith("$argon2id$")
        request("POST", "/api/auth/login", 401, {"email": legacy_email, "password": "credencial-incorrecta"})
        assert usuario(legacy_email, por_correo=True)["password_hash"] == legacy_hash
        legacy_login = {"email": legacy_email, "password": password}
        request("POST", "/api/auth/login", data=legacy_login)
        assert usuario(legacy_email, por_correo=True)["password_hash"].startswith("$argon2id$")
        request("POST", "/api/auth/login", data=legacy_login)

        expired = jwt.encode(
            {"sub": usuario(owner_email, por_correo=True)["id"], "exp": int(time.time()) - 1},
            os.environ["ROOMI_JWT_SECRET"], algorithm="HS256",
        )
        request("GET", "/api/auth/perfil", 401, token=expired)
        endpoint_admin = "/api/administracion/resumen"
        request("GET", endpoint_admin, 401)
        request("GET", endpoint_admin, 403, token=student)
        request("GET", endpoint_admin, 403, token=owner)
        request("POST", "/api/auth/registro", 422, {**registration, "role": "admin"})
        admin = login(admin_email)
        request("GET", "/api/administracion/no-existe", 422, token=admin)
        assert request("GET", "/api/auth/perfil", token=admin)["role"] == "admin"
        assert request("GET", endpoint_admin, token=admin)["usuarios"] >= 4
        admin_path = "/api/administracion"
        for section in ("usuarios", "anuncios", "reportes", "resenas", "consultas", "moderacion"):
            request("GET", f"{admin_path}/{section}", 401)
            request("GET", f"{admin_path}/{section}", 403, token=student)
            request("GET", f"{admin_path}/{section}", token=admin)
        users = request("GET", f"{admin_path}/usuarios?buscar={owner_email}", token=admin)["registros"]
        assert len(users) == 1 and users[0]["correo"] == owner_email and "password_hash" not in users[0]
        page = request("GET", f"{admin_path}/usuarios?tamano=1", token=admin)
        following = request("GET", f"{admin_path}/usuarios?tamano=1&pagina=2", token=admin)
        assert page["haySiguiente"] and page["registros"][0]["id"] != following["registros"][0]["id"]
        request("GET", "/api/propietario/alojamientos", 403, token=admin)
        assert endpoint_admin in request("GET", "/openapi.json")["paths"]
        draft = {
            "title": f"Habitación de prueba {data_key}", "zone": "San Carlos", "university": "Continental",
            "type": "Habitación", "price": 320, "deposit": 100, "minutes": 8, "amenities": ["Wifi"],
            "description": "Habitación ficticia del recorrido de integración.", "rules": "Pago mensual.",
            "address": "Dirección aproximada ficticia", "photos": [{"src": PHOTO, "alt": "Imagen ficticia"}],
            "latitude": -12.06, "longitude": -75.21, "distanceKm": 1.2,
            "whatsapp": "999000000",
        }
        rooms = "/api/alojamientos"
        direct = request("POST", rooms, 201, draft, owner)
        assert direct["status"] == "publicado"
        direct_id = direct["id"]
        request("GET", f"{rooms}/{direct_id}")
        delete_admin = f"{admin_path}/anuncios/{direct_id}/eliminar"
        reason = f"Moderación de prueba {data_key}"
        request("POST", delete_admin, 401, {"motivo": reason})
        request("POST", delete_admin, 403, {"motivo": reason}, owner)
        request("POST", delete_admin, 422, {"motivo": "  "}, admin)
        request("POST", delete_admin, 204, {"motivo": reason}, admin)
        request("POST", delete_admin, 404, {"motivo": reason}, admin)
        request("GET", f"{rooms}/{direct_id}", 404)
        assert all(row["id"] != direct_id for row in request("GET", rooms))
        managed_record = request("GET", f"{admin_path}/anuncios?buscar={direct_id}", token=admin)["registros"]
        assert len(managed_record) == 1 and managed_record[0]["estado"] == "Eliminado"
        history = request("GET", f"{admin_path}/moderacion?buscar=Moderaci%C3%B3n%20de%20prueba%20{data_key}", token=admin)["registros"]
        assert len(history) == 1 and history[0]["accion"] == "eliminar"
        assert history[0]["motivo"] == reason and history[0]["responsable"] == "Administrador de prueba"
        request("GET", "/api/auth/perfil", 401)
        profile = request("GET", "/api/auth/perfil", token=owner)
        assert profile["email"] == owner_email and profile["role"] == "user"
        assert request("GET", "/api/auth/perfil", token=student)["role"] == "user"
        request("POST", rooms, 401, draft)
        request("POST", rooms, 422, {**draft, "price": -1}, owner)
        invalid = {**draft, "photos": []}
        assert "Agrega al menos una foto" in request("POST", rooms, 422, invalid, owner)["detail"]
        draft_result = request("POST", rooms, 201, {**invalid, "borrador": True}, owner)
        assert draft_result["status"] == "borrador"
        room_id = draft_result["id"]
        print(f"Anuncio ficticio: {room_id}", flush=True)
        detail = f"{rooms}/{room_id}"
        own_detail = f"/api/propietario/alojamientos/{room_id}"
        request("GET", own_detail, 401)
        request("GET", own_detail, 404, token=other)
        request("GET", "/api/propietario/alojamientos/no-existe", 404, token=owner)
        request("GET", f"/api/propietario/alojamientos/{'x' * 101}", 422, token=owner)
        assert request("GET", own_detail, token=owner)["id"] == room_id
        request("GET", detail, 404)
        assert not request("GET", "/api/propietario/alojamientos", token=other)
        request("PUT", detail, 404, draft, other)
        request("POST", detail + "/enviar", 422, token=owner)
        assert request("PUT", detail, 200, draft, owner)["status"] == "borrador"
        assert request("POST", detail + "/enviar", 200, token=owner)["status"] == "publicado"
        public = request("GET", detail)
        assert public["distanceKm"] == 1.2
        photo = public["photos"][0]
        assert_photo(photo["src"])
        assert "whatsapp" not in public
        request("GET", detail + "/contacto", 401)
        assert request("GET", detail + "/contacto", token=student)["whatsapp"] == "51999000000"
        assert any(item["id"] == room_id for item in request("GET", f"{rooms}?precio=320&distancia=2&servicio=Wifi"))
        assert all(item["id"] != room_id for item in request("GET", f"{rooms}?distancia=1"))
        inquiry = {
            "name": "Estudiante de prueba", "email": f"estudiante-{data_key}@roomi.test", "whatsapp": "999000001",
            "message": "Quisiera conocer el alojamiento.", "consent": True,
        }
        request("POST", detail + "/consultas", 401, inquiry)
        request("POST", detail + "/consultas", 422, {**inquiry, "consent": False}, student)
        inquiry_id = request("POST", detail + "/consultas", 201, inquiry, student)["id"]
        inquiry_status = f"/api/propietario/consultas/{inquiry_id}"
        request("PATCH", inquiry_status, 404, {"respondida": True}, other)
        request("PATCH", inquiry_status, 204, {"respondida": True}, owner)
        assert next(row for row in request("GET", "/api/propietario/consultas", token=owner) if row["id"] == inquiry_id)["respondidaEn"]
        occupancy = own_detail + "/disponibilidad"
        request("PATCH", occupancy, 404, {"ocupado": True}, other)
        request("PATCH", occupancy, 204, {"ocupado": True}, owner)
        request("GET", detail, 404)
        assert all(item["id"] != room_id for item in request("GET", rooms))
        request("PATCH", occupancy, 204, {"ocupado": False}, owner)
        request("GET", detail)
        request("POST", detail + "/resenas", 201, {"rating": 4, "message": "Reseña ficticia de prueba."}, student)
        request("POST", detail + "/resenas", 409, {"rating": 4, "message": "Reseña ficticia de prueba."}, student)
        assert request("GET", detail + "/resenas")[0]["rating"] == 4
        assert any(row["roomId"] == room_id for row in request("GET", "/api/propietario/consultas", token=owner))
        assert not request("GET", "/api/propietario/consultas", token=other)

        stop(process)
        process = start()
        assert request("GET", detail)["photos"][0] == photo
        assert_photo(photo["src"])
        assert any(row["roomId"] == room_id for row in request("GET", "/api/propietario/consultas", token=owner))

        report = {"message": "Reporte ficticio de prueba."}
        request("POST", detail + "/reportes", 201, report, student)
        request("POST", detail + "/reportes", 409, report, student)
        for section in ("anuncios", "reportes", "resenas", "consultas", "moderacion"):
            listing = request("GET", f"{admin_path}/{section}?buscar={data_key}", token=admin)
            assert listing["registros"], section
        assert request("GET", detail)["id"] == room_id
        assert any(item["id"] == room_id for item in request("GET", rooms))
        request("PUT", detail, 422, {**draft, "photos": []}, owner)
        assert request("GET", detail)["price"] == 320
        assert request("PUT", detail, 200, {**draft, "price": 310, "photos": [photo]}, owner)["status"] == "publicado"
        assert request("GET", detail)["price"] == 310
        request("PATCH", detail + "/estado", 204, {"status": "retirado"}, owner)
        request("GET", detail, 404)
        assert request("GET", own_detail, token=owner)["status"] == "retirado"
        assert request("POST", detail + "/reactivar", 200, token=owner)["status"] == "publicado"
        request("GET", detail)
        request("PATCH", detail + "/estado", 204, {"status": "retirado"}, owner)
        request("DELETE", detail, 401)
        request("DELETE", detail, 404, token=other)
        request("DELETE", f"{rooms}/no-existe", 404, token=owner)
        request("DELETE", f"{rooms}/{'x' * 101}", 422, token=owner)
        request("DELETE", detail, 204, token=owner)
        request("DELETE", detail, 404, token=owner)
        request("PUT", detail, 404, draft, owner)
        request("GET", own_detail, 404, token=owner)
        request("GET", detail, 404)
        with abrir_conexion() as connection:
            cursor = connection.cursor()
            status, deleted_at = cursor.execute(
                "SELECT [status], deleted_at FROM dbo.alojamientos WHERE id=?", room_id,
            ).fetchone()
            assert status == "retirado" and deleted_at is not None
            for table, expected in (("consultas", 1), ("resenas", 1), ("reportes", 1)):
                assert cursor.execute(f"SELECT COUNT(*) FROM dbo.{table} WHERE alojamiento_id=?", room_id).fetchone()[0] == expected
        print(f"Recorrido HTTP, reinicio y persistencia ODBC correctos para {room_id}.")
    finally:
        stop(process)


if __name__ == "__main__":
    main()

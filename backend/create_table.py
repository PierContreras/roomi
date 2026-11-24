import argparse
import getpass
import json
from pathlib import Path

from backend.db_connection import ConexionSqlError, abrir_conexion
from backend.repositories.datos_demo import ALOJAMIENTOS_DEMO
from backend.repositories.gestion import inscribir
from backend.schemas.gestion import Registro
from backend.services.seguridad import hash_password

MIGRACIONES = Path(__file__).parent / "migrations"
ESQUEMA_SQL = (
    "000_catalogo.sql",
    "001_gestion.sql",
    "002_indices.sql",
    "003_eliminacion_anuncios.sql",
    "004_hash_contrasena_unicode.sql",
    "005_ampliar_hash_contrasena.sql",
)

INSERTAR_DEMO = """
INSERT INTO dbo.alojamientos (
    id, title, zone, university, [type], price, deposit, minutes, amenities_json,
    description, rules, address, photos_json, [owner], [status]
)
SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved'
WHERE NOT EXISTS (SELECT 1 FROM dbo.alojamientos WITH (UPDLOCK, HOLDLOCK) WHERE id = ?);
"""


def main() -> None:
    parser = argparse.ArgumentParser(description="Inicializa o actualiza el esquema de ROOMI.")
    parser.add_argument("--datos-demo", action="store_true", help="Inserta ejemplos que todavía no existan.")
    parser.add_argument("--admin-email", help="Crea una cuenta de administración por consola.")
    opciones = parser.parse_args()
    try:
        with abrir_conexion() as conexion:
            cursor = conexion.cursor()
            cursor.execute("SET XACT_ABORT ON")
            for archivo in ESQUEMA_SQL:
                cursor.execute((MIGRACIONES / archivo).read_text(encoding="utf-8"))
            if opciones.datos_demo:
                for room in ALOJAMIENTOS_DEMO:
                    cursor.execute(
                        INSERTAR_DEMO, room.id, room.title, room.zone, room.university,
                        room.type, room.price, room.deposit, room.minutes,
                        json.dumps(room.amenities, ensure_ascii=False),
                        room.description, room.rules, room.address,
                        json.dumps([foto.model_dump() for foto in room.photos], ensure_ascii=False),
                        room.owner, room.id,
                    )
            conexion.commit()
    except ConexionSqlError as error:
        parser.exit(1, f"{error}\n")

    print("El esquema de ROOMI está disponible.")
    if opciones.admin_email:
        password = getpass.getpass("Contraseña de administrador: ")
        if password != getpass.getpass("Confirma la contraseña: "):
            parser.exit(1, "Las contraseñas no coinciden.\n")
        try:
            admin = Registro(name="Administración ROOMI", email=opciones.admin_email, password=password, role="owner")
        except ValueError:
            parser.exit(1, "Ingresa un correo válido y una contraseña de 10 a 64 caracteres.\n")
        if not inscribir(admin.name, admin.email, "admin", hash_password(admin.password)):
            parser.exit(1, "Ese correo ya está registrado. Usa el acceso existente u otro correo.\n")
        print("Cuenta de administración creada.")


if __name__ == "__main__":
    main()

import argparse
import json

from backend.db_connection import ConexionSqlError, abrir_conexion
from backend.repositories.datos_demo import ALOJAMIENTOS_DEMO

CREAR_TABLA = """
IF OBJECT_ID(N'dbo.alojamientos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.alojamientos (
        id VARCHAR(100) NOT NULL PRIMARY KEY,
        title NVARCHAR(200) NOT NULL,
        zone NVARCHAR(60) NOT NULL,
        university NVARCHAR(60) NOT NULL,
        [type] NVARCHAR(40) NOT NULL,
        price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
        deposit DECIMAL(10, 2) NOT NULL CHECK (deposit >= 0),
        minutes INT NOT NULL CHECK (minutes >= 0),
        amenities_json NVARCHAR(MAX) NOT NULL CHECK (ISJSON(amenities_json) = 1),
        description NVARCHAR(2000) NOT NULL,
        rules NVARCHAR(2000) NOT NULL,
        address NVARCHAR(250) NOT NULL,
        photos_json NVARCHAR(MAX) NOT NULL CHECK (ISJSON(photos_json) = 1),
        [owner] NVARCHAR(200) NOT NULL,
        [status] VARCHAR(12) NOT NULL CHECK ([status] IN ('pending', 'approved', 'rejected', 'withdrawn'))
    );
END;
"""

INSERTAR_DEMO = """
INSERT INTO dbo.alojamientos (
    id, title, zone, university, [type], price, deposit, minutes, amenities_json,
    description, rules, address, photos_json, [owner], [status]
)
SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved'
WHERE NOT EXISTS (SELECT 1 FROM dbo.alojamientos WITH (UPDLOCK, HOLDLOCK) WHERE id = ?);
"""


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepara la tabla de alojamientos de ROOMI.")
    parser.add_argument("--datos-demo", action="store_true", help="Inserta ejemplos que todavía no existan.")
    opciones = parser.parse_args()
    try:
        with abrir_conexion() as conexion:
            cursor = conexion.cursor()
            cursor.execute(CREAR_TABLA)
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

    print("La tabla dbo.alojamientos está disponible.")


if __name__ == "__main__":
    main()

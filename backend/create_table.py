import argparse

from backend.db_connection import ConexionSqlError, abrir_conexion
from backend.repositories.datos_demo import ALOJAMIENTOS_DEMO


def main() -> None:
    parser = argparse.ArgumentParser(description="Carga anuncios ficticios en el esquema actual de ROOMI.")
    parser.add_argument("--datos-demo", action="store_true", required=True,
                        help="Añade los ejemplos sin modificar anuncios existentes.")
    parser.parse_args()

    added = 0
    try:
        with abrir_conexion() as conexion:
            cursor = conexion.cursor()
            cursor.execute("SET XACT_ABORT ON")
            for room in ALOJAMIENTOS_DEMO:
                cursor.execute("""
                    INSERT dbo.alojamientos (
                        id, title, zone, university, [type], price, deposit, minutes,
                        description, rules, address, [status]
                    )
                    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'publicado'
                    WHERE NOT EXISTS (
                        SELECT 1 FROM dbo.alojamientos WITH (UPDLOCK, HOLDLOCK) WHERE id = ?
                    )
                """, room.id, room.title, room.zone, room.university, room.type, room.price,
                    room.deposit, room.minutes, room.description, room.rules, room.address, room.id)
                if not cursor.rowcount:
                    continue
                cursor.execute("""
                    INSERT dbo.alojamiento_titular_historico (alojamiento_id, nombre) VALUES (?, ?)
                """, room.id, room.owner)
                cursor.executemany("""
                    INSERT dbo.alojamiento_servicios (alojamiento_id, servicio, posicion) VALUES (?, ?, ?)
                """, [(room.id, servicio, posicion) for posicion, servicio in enumerate(room.amenities)])
                added += 1
            conexion.commit()
    except ConexionSqlError:
        parser.exit(1, "No se pudieron cargar los ejemplos. Verifica la conexión y aplica instalar_roomi.sql.\n")

    print(f"Anuncios ficticios añadidos: {added}.")


if __name__ == "__main__":
    main()

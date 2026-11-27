from backend.db_connection import abrir_conexion
from backend.services.archivos_fotos import guardar_foto


def main() -> None:
    with abrir_conexion() as conexion:
        cursor = conexion.cursor()
        cursor.execute("SET XACT_ABORT ON")
        filas = cursor.execute("""
            SELECT alojamiento_id, posicion, src
            FROM dbo.alojamiento_fotos WITH (UPDLOCK, HOLDLOCK)
            WHERE src LIKE N'data:image/%'
        """).fetchall()
        for alojamiento_id, posicion, src in filas:
            cursor.execute("""
                UPDATE dbo.alojamiento_fotos SET src = ? WHERE alojamiento_id = ? AND posicion = ?
            """, guardar_foto(src), alojamiento_id, posicion)
        conexion.commit()
    print(f"Fotos migradas: {len(filas)}.")


if __name__ == "__main__":
    main()

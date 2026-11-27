import argparse

from backend.db_connection import abrir_conexion


def main() -> None:
    parser = argparse.ArgumentParser(description="Asigna el rol administrador a una cuenta registrada de ROOMI.")
    parser.add_argument("--email", required=True)
    args = parser.parse_args()
    with abrir_conexion() as conexion:
        cursor = conexion.cursor().execute("""
            UPDATE u SET rol_id = r.id
            FROM dbo.usuarios u CROSS JOIN dbo.roles r
            WHERE u.email = ? AND r.codigo = 'admin'
        """, args.email.strip().lower())
        if cursor.rowcount != 1:
            parser.exit(1, "Verifica el correo y que la migración de roles esté aplicada.\n")
        conexion.commit()
    print("Rol de administrador asignado. Inicia sesión de nuevo para abrir Administración.")


if __name__ == "__main__":
    main()

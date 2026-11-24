import argparse
import getpass
import sys

from pydantic import ValidationError

from backend.repositories.gestion import crear_admin
from backend.schemas.gestion import Acceso
from backend.services.seguridad import hash_password


def main():
    parser = argparse.ArgumentParser(description="Crear o promover una cuenta de administración.")
    parser.add_argument("correo")
    args = parser.parse_args()
    if not sys.stdin.isatty():
        parser.error("Ejecuta este comando en una consola interactiva.")
    try:
        cuenta = Acceso(email=args.correo, password=getpass.getpass("Contraseña: "))
    except ValidationError:
        parser.error("Usa un correo válido y una contraseña de entre 10 y 64 caracteres.")
    crear_admin(cuenta.email, hash_password(cuenta.password))
    print("Cuenta de administración configurada.")


if __name__ == "__main__":
    main()

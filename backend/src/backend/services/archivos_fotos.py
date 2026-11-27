import base64
import binascii
import hashlib
import os
import re
from pathlib import Path
from tempfile import NamedTemporaryFile

CARPETA_FOTOS = Path(__file__).resolve().parents[3] / "uploads" / "alojamientos"
PREFIJO_FOTOS = "/api/media/alojamientos/"
NOMBRE_FOTO = re.compile(r"[0-9a-f]{64}\.(?:jpg|png|webp)")


def es_ruta_foto(src: str) -> bool:
    return src.startswith(PREFIJO_FOTOS) and NOMBRE_FOTO.fullmatch(src[len(PREFIJO_FOTOS):]) is not None


def decodificar_foto(src: str) -> tuple[bytes, str]:
    cabecera, _, datos = src.partition(",")
    try:
        contenido = base64.b64decode(datos, validate=True)
    except binascii.Error:
        raise ValueError("La foto no tiene un formato válido.") from None
    if cabecera == "data:image/jpeg;base64" and contenido.startswith(b"\xff\xd8\xff"):
        return contenido, "jpg"
    if cabecera == "data:image/png;base64" and contenido.startswith(b"\x89PNG\r\n\x1a\n"):
        return contenido, "png"
    if cabecera == "data:image/webp;base64" and contenido.startswith(b"RIFF") and contenido[8:12] == b"WEBP":
        return contenido, "webp"
    raise ValueError("Usa una foto JPG, PNG o WebP.")


def guardar_foto(src: str) -> str:
    if es_ruta_foto(src):
        return src
    contenido, extension = decodificar_foto(src)
    nombre = f"{hashlib.sha256(contenido).hexdigest()}.{extension}"
    destino = CARPETA_FOTOS / nombre
    CARPETA_FOTOS.mkdir(parents=True, exist_ok=True)
    if not destino.is_file():
        archivo = NamedTemporaryFile(dir=CARPETA_FOTOS, delete=False)
        temporal = Path(archivo.name)
        try:
            with archivo:
                archivo.write(contenido)
            try:
                os.replace(temporal, destino)
            except OSError:
                if not destino.is_file():
                    raise
        finally:
            temporal.unlink(missing_ok=True)
    return PREFIJO_FOTOS + nombre

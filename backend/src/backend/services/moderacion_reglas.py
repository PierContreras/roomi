import os
import re
import unicodedata
from decimal import Decimal

from backend.services.exceptions import PublicacionInvalida

CONTACTO = re.compile(
    r"(?<!\w)@[\w.]+|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}|"
    r"\b(?:https?|ftp)://|www\.|\b[\w-]+(?:\.[\w-]+)*\.(?:com|org|net|pe|io|me|co|app|ly|info|test|edu|gov)\b|"
    r"\b(?:whats\s*app|facebook|instagram|tik\s*tok|telegram|snapchat|linkedin|twitter|discord|messenger)\b|"
    r"(?<!\w)\+?(?:\d[ ().-]*){8,15}(?!\w)"
)


def normalizar(texto: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", texto.casefold()) if not unicodedata.combining(c))


def validar_publicacion(anuncio) -> None:
    minimo = Decimal(os.getenv("ROOMI_PRECIO_MINIMO", "50"))
    maximo = Decimal(os.getenv("ROOMI_PRECIO_MAXIMO", "2000"))
    terminos = [normalizar(t.strip()) for t in os.getenv("ROOMI_TERMINOS_PROHIBIDOS", "").split(",") if t.strip()]
    texto = normalizar(f"{anuncio.title}\n{anuncio.description}")
    motivos = []
    if not anuncio.title.strip() or not anuncio.description.strip():
        motivos.append("Completa el título y la descripción del anuncio.")
    if not any(foto.src.strip() for foto in anuncio.photos):
        motivos.append("Agrega al menos una foto.")
    if not re.fullmatch(r"[1-9][0-9]{7,14}", anuncio.whatsapp or ""):
        motivos.append("Ingresa un número de WhatsApp válido para publicar.")
    if not minimo <= Decimal(str(anuncio.price)) <= maximo:
        motivos.append(f"Ingresa un precio mensual entre S/ {minimo} y S/ {maximo}.")
    if CONTACTO.search(texto):
        motivos.append("Quita los datos de contacto del título y la descripción. Usa el campo de WhatsApp.")
    if any(termino in texto for termino in terminos):
        motivos.append("Corrige el término restringido en el título o la descripción.")
    if motivos:
        raise PublicacionInvalida(" ".join(motivos))

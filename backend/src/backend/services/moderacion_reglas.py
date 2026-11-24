import os
import re
import unicodedata
from decimal import Decimal

CONTACTO = re.compile(
    r"(?<!\w)@[\w.]+|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}|"
    r"\b(?:https?|ftp)://|www\.|\b[\w-]+(?:\.[\w-]+)*\.(?:com|org|net|pe|io|me|co|app|ly|info|test|edu|gov)\b|"
    r"\b(?:whats\s*app|facebook|instagram|tik\s*tok|telegram|snapchat|linkedin|twitter|discord|messenger)\b|"
    r"(?<!\w)\+?(?:\d[ ().-]*){8,15}(?!\w)"
)


def normalizar(texto: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", texto.casefold()) if not unicodedata.combining(c))


def evaluar(anuncio, *, suspendido: bool, reportes_abiertos: bool) -> list[str]:
    minimo = Decimal(os.getenv("ROOMI_PRECIO_MINIMO", "50"))
    maximo = Decimal(os.getenv("ROOMI_PRECIO_MAXIMO", "2000"))
    terminos = [normalizar(t.strip()) for t in os.getenv("ROOMI_TERMINOS_PROHIBIDOS", "").split(",") if t.strip()]
    texto = normalizar(f"{anuncio.title}\n{anuncio.description}")
    motivos = []
    if not anuncio.title.strip() or not anuncio.description.strip():
        motivos.append("datos_invalidos")
    if not any(foto.src.strip() for foto in anuncio.photos):
        motivos.append("sin_fotos")
    if not minimo <= Decimal(str(anuncio.price)) <= maximo:
        motivos.append("precio_fuera_de_rango")
    if CONTACTO.search(texto):
        motivos.append("contacto_externo")
    if any(termino in texto for termino in terminos):
        motivos.append("termino_prohibido")
    if suspendido:
        motivos.append("propietario_suspendido")
    if reportes_abiertos:
        motivos.append("reportes_abiertos")
    return motivos

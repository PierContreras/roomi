import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from backend.services.exceptions import PublicacionInvalida
from backend.services.moderacion_reglas import validar_publicacion


class ReglasModeracionTests(unittest.TestCase):
    def test_reglas(self):
        foto = SimpleNamespace(src="data:image/png;base64,ejemplo")
        datos = {"title": "Habitación luminosa", "description": "Cerca del campus", "photos": [foto], "price": 300,
                 "whatsapp": "51987000000"}
        casos = [
            ({}, []),
            ({"photos": []}, ["Agrega al menos una foto"]),
            ({"whatsapp": None}, ["Ingresa un número de WhatsApp válido"]),
            ({"whatsapp": "123"}, ["Ingresa un número de WhatsApp válido"]),
            ({"title": " "}, ["Completa el título y la descripción"]),
            ({"price": 49}, ["Ingresa un precio mensual"]),
            ({"price": 2001}, ["Ingresa un precio mensual"]),
            ({"price": 50}, []),
            ({"price": 2000}, []),
            ({"description": "Escribe a nombre@example.test"}, ["Quita los datos de contacto"]),
            ({"description": "Llama al +51 987 654 321"}, ["Quita los datos de contacto"]),
            ({"description": "Visita https://example.test"}, ["Quita los datos de contacto"]),
            ({"description": "Busca mi Ínstagram"}, ["Quita los datos de contacto"]),
            ({"description": "Busca @micuenta"}, ["Quita los datos de contacto"]),
            ({"title": "Anuncio RESTRÍNGIDO"}, ["Corrige el término restringido"]),
            ({"photos": [], "price": 49}, ["Agrega al menos una foto", "Ingresa un precio mensual"]),
        ]
        with patch.dict(os.environ, {
            "ROOMI_PRECIO_MINIMO": "50", "ROOMI_PRECIO_MAXIMO": "2000", "ROOMI_TERMINOS_PROHIBIDOS": "restringido",
        }):
            for cambios, esperados in casos:
                with self.subTest(cambios=cambios):
                    anuncio = SimpleNamespace(**(datos | cambios))
                    if esperados:
                        with self.assertRaises(PublicacionInvalida) as error:
                            validar_publicacion(anuncio)
                        for mensaje in esperados:
                            self.assertIn(mensaje, str(error.exception))
                    else:
                        validar_publicacion(anuncio)

    def test_rango_configurado(self):
        with patch.dict(os.environ, {"ROOMI_PRECIO_MINIMO": "100", "ROOMI_PRECIO_MAXIMO": "120"}):
            anuncio = SimpleNamespace(title="Habitación", description="Amoblada",
                                      photos=[SimpleNamespace(src="data:image/png;base64,ejemplo")], price=121,
                                      whatsapp="51987000000")
            with self.assertRaisesRegex(PublicacionInvalida, r"entre S/ 100 y S/ 120"):
                validar_publicacion(anuncio)

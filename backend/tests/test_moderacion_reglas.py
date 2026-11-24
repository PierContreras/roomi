import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from backend.services.moderacion_reglas import evaluar


class ReglasModeracionTests(unittest.TestCase):
    def test_reglas(self):
        foto = SimpleNamespace(src="data:image/png;base64,ejemplo")
        datos = {"title": "Habitación luminosa", "description": "Cerca del campus", "photos": [foto], "price": 300}
        casos = [
            ({}, {}, []),
            ({"photos": []}, {}, ["sin_fotos"]),
            ({"title": " "}, {}, ["datos_invalidos"]),
            ({"price": 49}, {}, ["precio_fuera_de_rango"]),
            ({"price": 2001}, {}, ["precio_fuera_de_rango"]),
            ({"price": 50}, {}, []),
            ({"price": 2000}, {}, []),
            ({"description": "Escribe a nombre@example.test"}, {}, ["contacto_externo"]),
            ({"description": "Llama al +51 987 654 321"}, {}, ["contacto_externo"]),
            ({"description": "Visita https://example.test"}, {}, ["contacto_externo"]),
            ({"description": "Busca mi Ínstagram"}, {}, ["contacto_externo"]),
            ({"description": "Busca @micuenta"}, {}, ["contacto_externo"]),
            ({"title": "Anuncio RESTRÍNGIDO"}, {}, ["termino_prohibido"]),
            ({}, {"suspendido": True}, ["propietario_suspendido"]),
            ({}, {"reportes_abiertos": True}, ["reportes_abiertos"]),
            ({"photos": [], "price": 49}, {}, ["sin_fotos", "precio_fuera_de_rango"]),
        ]
        with patch.dict(os.environ, {
            "ROOMI_PRECIO_MINIMO": "50", "ROOMI_PRECIO_MAXIMO": "2000", "ROOMI_TERMINOS_PROHIBIDOS": "restringido",
        }):
            for cambios, riesgos, esperados in casos:
                with self.subTest(cambios=cambios, riesgos=riesgos):
                    anuncio = SimpleNamespace(**(datos | cambios))
                    contexto = {"suspendido": False, "reportes_abiertos": False} | riesgos
                    self.assertEqual(evaluar(anuncio, **contexto), esperados)

    def test_rango_configurado(self):
        with patch.dict(os.environ, {"ROOMI_PRECIO_MINIMO": "100", "ROOMI_PRECIO_MAXIMO": "120"}):
            anuncio = SimpleNamespace(title="Habitación", description="Amoblada",
                                      photos=[SimpleNamespace(src="data:image/png;base64,ejemplo")], price=121)
            self.assertEqual(evaluar(anuncio, suspendido=False, reportes_abiertos=False), ["precio_fuera_de_rango"])

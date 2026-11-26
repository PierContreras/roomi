import base64
import binascii
from typing import Annotated, Literal

from datetime import datetime

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, StringConstraints, field_validator

from backend.schemas.alojamiento import Alojamiento, Foto, Servicio, Tipo, Universidad, Zona

Texto = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
Correo = Annotated[str, StringConstraints(strip_whitespace=True, to_lower=True, max_length=180, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")]
Rol = Literal["student", "owner"]
Estado = Literal["borrador", "publicado", "retirado"]


class Entrada(BaseModel):
    model_config = ConfigDict(extra="forbid")


def normalizar_numero_whatsapp(numero):
    if not isinstance(numero, str):
        return numero
    digitos = "".join(numero.strip().removeprefix("+").split()).replace("-", "")
    if len(digitos) == 9 and digitos.startswith("9") and digitos.isascii() and digitos.isdigit():
        return "51" + digitos
    return digitos


WhatsApp = Annotated[str, StringConstraints(pattern=r"^[1-9][0-9]{7,14}$"), BeforeValidator(normalizar_numero_whatsapp)]


class Acceso(Entrada):
    model_config = ConfigDict(json_schema_extra={"examples": [{'email': 'ana@example.com', 'password': 'ejemplo-no-real-123'}]})
    email: Correo
    password: str = Field(min_length=10, max_length=64)


class Registro(Acceso):
    model_config = ConfigDict(json_schema_extra={"examples": [{'email': 'ana@example.com', 'password': 'ejemplo-no-real-123', 'name': 'Ana Pérez'}]})
    name: Texto = Field(max_length=100)
    role: Literal["student", "owner"] = "student"


class Usuario(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [{
            'id': '11111111-1111-4111-8111-111111111111',
            'name': 'Ana Pérez',
            'email': 'ana@example.com',
            'role': 'student',
    }]})
    id: str
    name: str
    email: str
    role: Rol


class Sesion(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [{
            'token': 'JWT_DE_EJEMPLO',
            'user': {'id': '11111111-1111-4111-8111-111111111111',
                     'name': 'Ana Pérez',
                     'email': 'ana@example.com',
                     'role': 'student'},
    }]})
    token: str
    user: Usuario


class Borrador(Entrada):
    model_config = ConfigDict(json_schema_extra={"examples": [{
            'title': 'Habitación cerca del campus',
            'zone': 'San Carlos',
            'university': 'Continental',
            'type': 'Habitación',
            'price': 320,
            'deposit': 100,
            'minutes': 8,
            'amenities': ['Wifi'],
            'description': 'Habitación con luz natural.',
            'rules': 'Pago mensual.',
            'address': 'San Carlos, Huancayo',
            'photos': [],
            'latitude': -12.06,
            'longitude': -75.21,
            'distanceKm': 1.2,
            'whatsapp': None,
    }]})
    title: Texto = Field(max_length=200)
    zone: Zona
    university: Universidad
    type: Tipo
    price: float = Field(ge=0, le=99999999.99)
    deposit: float = Field(ge=0, le=99999999.99)
    minutes: int = Field(ge=0, le=1440)
    amenities: tuple[Servicio, ...] = Field(max_length=6)
    description: Texto = Field(max_length=2000)
    rules: Texto = Field(max_length=2000)
    address: Texto = Field(max_length=250)
    photos: tuple[Foto, ...] = Field(max_length=3)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    distanceKm: float = Field(ge=0, le=100)
    whatsapp: WhatsApp | None = None

    @field_validator("photos")
    @classmethod
    def validar_fotos(cls, fotos):
        for foto in fotos:
            header, _, data = foto.src.partition(",")
            if len(foto.alt) > 200 or len(data) > 533336:
                raise ValueError("Cada foto puede tener hasta 400 KB.")
            try:
                binary = base64.b64decode(data, validate=True)
            except binascii.Error:
                raise ValueError("La foto no tiene un formato válido.") from None
            valid = (
                (header == "data:image/jpeg;base64" and binary.startswith(b"\xff\xd8\xff"))
                or (header == "data:image/png;base64" and binary.startswith(b"\x89PNG\r\n\x1a\n"))
                or (header == "data:image/webp;base64" and binary.startswith(b"RIFF") and binary[8:12] == b"WEBP")
            )
            if not valid or len(binary) > 400000:
                raise ValueError("Usa una foto JPG, PNG o WebP de hasta 400 KB.")
        return fotos


class SolicitudAnuncio(Borrador):
    borrador: bool = False


class AnuncioGestionado(Alojamiento):
    model_config = ConfigDict(json_schema_extra={"examples": [{
            'id': 'anuncio-ejemplo',
            'title': 'Habitación cerca del campus',
            'zone': 'San Carlos',
            'university': 'Continental',
            'type': 'Habitación',
            'price': 320,
            'deposit': 100,
            'minutes': 8,
            'amenities': ['Wifi'],
            'description': 'Habitación con luz natural.',
            'rules': 'Pago mensual.',
            'address': 'San Carlos, Huancayo',
            'photos': [],
            'owner': 'Ana Pérez',
            'latitude': -12.06,
            'longitude': -75.21,
            'distanceKm': 1.2,
            'contactAvailable': True,
            'status': 'borrador',
            'ownerId': '11111111-1111-4111-8111-111111111111',
            'whatsapp': None,
    }]})
    ownerId: str | None
    status: Estado
    ocupado: bool = False


class Disponibilidad(Entrada):
    ocupado: bool


class EstadoConsulta(Entrada):
    respondida: bool


class Retiro(Entrada):
    model_config = ConfigDict(json_schema_extra={"examples": [{'status': 'retirado'}]})
    status: Literal["retirado"]


class Consulta(Entrada):
    model_config = ConfigDict(json_schema_extra={"examples": [{
            'name': 'Ana Pérez',
            'whatsapp': '51987654321',
            'email': 'ana@example.com',
            'message': 'Me interesa conocer el alojamiento.',
            'consent': True,
    }]})
    name: Texto = Field(max_length=100)
    whatsapp: WhatsApp
    email: Correo | None = None
    message: Texto = Field(min_length=10, max_length=800)
    consent: Literal[True]


class ConsultaRecibida(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [{
            'id': 'ejemplo',
            'roomId': 'anuncio-ejemplo',
            'title': 'Habitación cerca del campus',
            'name': 'Ana Pérez',
            'email': 'ana@example.com',
            'message': 'Me interesa conocer el alojamiento.',
    }]})
    id: str
    roomId: str
    title: str
    name: str
    whatsapp: str | None
    email: str | None
    message: str
    creadaEn: datetime
    respondidaEn: datetime | None


class Reporte(Entrada):
    model_config = ConfigDict(json_schema_extra={"examples": [{'message': 'La dirección del anuncio parece incorrecta.'}]})
    message: Texto = Field(min_length=10, max_length=800)


class Resena(Reporte):
    model_config = ConfigDict(json_schema_extra={"examples": [{'message': 'La habitación recibe luz natural.', 'rating': 4}]})
    rating: int = Field(ge=1, le=5)


class ResenaPublica(Resena):
    model_config = ConfigDict(json_schema_extra={"examples": [{
            'id': 'resena-ejemplo',
            'name': 'Ana Pérez',
            'message': 'La habitación recibe luz natural.',
            'rating': 4,
    }]})
    id: str
    name: str


class Creado(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [{'id': 'recurso-ejemplo'}]})
    id: str


class ResultadoAnuncio(Creado):
    status: Estado

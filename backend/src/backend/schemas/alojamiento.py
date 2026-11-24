from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Zona = Literal["San Carlos", "El Tambo", "Centro", "Chilca"]
Universidad = Literal["Continental", "UNCP", "UPLA", "UTP"]
Tipo = Literal["Habitación", "Minidepartamento"]
Servicio = Literal["Wifi", "Baño privado", "Amoblado", "Lavandería", "Cocineta", "Agua caliente"]


class Foto(BaseModel):
    src: str
    alt: str


class AlojamientoPublico(BaseModel):
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
    }]})
    id: str
    title: str
    zone: Zona
    university: Universidad
    type: Tipo
    price: float = Field(ge=0)
    deposit: float = Field(ge=0)
    minutes: int = Field(ge=0)
    amenities: tuple[Servicio, ...] = ()
    description: str
    rules: str
    address: str
    photos: tuple[Foto, ...] = ()
    owner: str
    latitude: float | None = None
    longitude: float | None = None
    distanceKm: float | None = None
    contactAvailable: bool = False


class Alojamiento(AlojamientoPublico):
    whatsapp: str | None = None

    def ficha_publica(self) -> AlojamientoPublico:
        return AlojamientoPublico.model_validate({
            **self.model_dump(exclude={"whatsapp"}),
            "contactAvailable": self.contactAvailable or bool(self.whatsapp),
        })


class ContactoAlojamiento(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [{'whatsapp': None, 'formulario': True}]})
    whatsapp: str | None
    formulario: bool


class FiltrosAlojamiento(BaseModel):
    zona: Zona | None = None
    universidad: Universidad | None = None
    tipo: Tipo | None = None
    precio: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    minutos: int | None = Field(default=None, ge=0)
    distancia: float | None = Field(default=None, ge=0, le=100, allow_inf_nan=False)
    servicio: tuple[Servicio, ...] = ()

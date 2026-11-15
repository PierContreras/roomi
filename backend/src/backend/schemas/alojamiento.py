from typing import Literal

from pydantic import BaseModel, Field

Zona = Literal["San Carlos", "El Tambo", "Centro", "Chilca"]
Universidad = Literal["Continental", "UNCP", "UPLA", "UTP"]
Tipo = Literal["Habitación", "Minidepartamento"]
Servicio = Literal["Wifi", "Baño privado", "Amoblado", "Lavandería", "Cocineta", "Agua caliente"]


class Foto(BaseModel):
    src: str
    alt: str


class Alojamiento(BaseModel):
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


class FiltrosAlojamiento(BaseModel):
    zona: Zona | None = None
    universidad: Universidad | None = None
    tipo: Tipo | None = None
    precio: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    minutos: int | None = Field(default=None, ge=0)
    servicio: tuple[Servicio, ...] = ()

from typing import Annotated

from fastapi import APIRouter, Query, Response

from backend.apis.gestion import Id, PROTEGIDA, cuenta_publica
from backend.schemas.alojamiento import AlojamientoPublico, ContactoAlojamiento, FiltrosAlojamiento
from backend.services.alojamientos import ServicioAlojamientos


def crear_router(servicio: ServicioAlojamientos) -> APIRouter:
    router = APIRouter(prefix="/alojamientos", tags=["Alojamientos"])

    no_encontrado = {404: {"description": "Alojamiento público no encontrado."}}

    @router.get("", summary="Buscar alojamientos", description="Filtra el catálogo de anuncios aprobados por ubicación, precio, cercanía y servicios.")
    def listar_alojamientos(
        filtros: Annotated[FiltrosAlojamiento, Query()],
    ) -> list[AlojamientoPublico]:
        return [alojamiento.ficha_publica() for alojamiento in servicio.listar(filtros)]

    @router.get(
        "/{anuncio_id}", summary="Consultar la ficha pública",
        description="Devuelve la ficha de un anuncio aprobado.",
        responses=no_encontrado,
    )
    def detalle_alojamiento(anuncio_id: Id) -> AlojamientoPublico:
        return servicio.obtener(anuncio_id).ficha_publica()

    @router.get(
        "/{anuncio_id}/contacto", tags=["Contactos"],
        summary="Consultar opciones de contacto",
        description="Devuelve el número de WhatsApp, si está configurado, y la disponibilidad del formulario.",
        dependencies=[cuenta_publica], responses={**PROTEGIDA, **no_encontrado},
    )
    def contacto_alojamiento(anuncio_id: Id, response: Response) -> ContactoAlojamiento:
        alojamiento = servicio.obtener(anuncio_id)
        response.headers["Cache-Control"] = "private, no-store"
        return ContactoAlojamiento(whatsapp=alojamiento.whatsapp, formulario=alojamiento.contactAvailable)

    return router

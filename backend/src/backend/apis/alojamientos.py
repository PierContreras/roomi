from typing import Annotated

from fastapi import APIRouter, Query

from backend.schemas.alojamiento import Alojamiento, FiltrosAlojamiento
from backend.services.alojamientos import ServicioAlojamientos


def crear_router(servicio: ServicioAlojamientos) -> APIRouter:
    router = APIRouter(prefix="/alojamientos", tags=["Alojamientos"])

    @router.get("")
    def listar_alojamientos(
        filtros: Annotated[FiltrosAlojamiento, Query()],
    ) -> list[Alojamiento]:
        return servicio.listar(filtros)

    @router.get("/{anuncio_id}")
    def detalle_alojamiento(anuncio_id: str) -> Alojamiento:
        return servicio.obtener(anuncio_id)

    return router

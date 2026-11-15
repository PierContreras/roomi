from backend.repositories.alojamientos import RepositorioAlojamientos
from backend.schemas.alojamiento import Alojamiento, FiltrosAlojamiento
from backend.services.exceptions import AlojamientoNoEncontrado


class ServicioAlojamientos:
    def __init__(self, repositorio: RepositorioAlojamientos) -> None:
        self._repositorio = repositorio

    def listar(self, filtros: FiltrosAlojamiento) -> list[Alojamiento]:
        servicios = set(filtros.servicio)
        return [
            alojamiento
            for alojamiento in self._repositorio.listar_publicados()
            if (filtros.zona is None or alojamiento.zone == filtros.zona)
            and (filtros.universidad is None or alojamiento.university == filtros.universidad)
            and (filtros.tipo is None or alojamiento.type == filtros.tipo)
            and (filtros.precio is None or alojamiento.price <= filtros.precio)
            and (filtros.minutos is None or alojamiento.minutes <= filtros.minutos)
            and servicios.issubset(alojamiento.amenities)
        ]

    def obtener(self, anuncio_id: str) -> Alojamiento:
        alojamiento = self._repositorio.buscar_publicado(anuncio_id)
        if alojamiento is None:
            raise AlojamientoNoEncontrado(anuncio_id)
        return alojamiento

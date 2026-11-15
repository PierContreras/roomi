from collections.abc import Sequence
from typing import Protocol

from backend.schemas.alojamiento import Alojamiento


class RepositorioAlojamientos(Protocol):
    def listar_publicados(self) -> Sequence[Alojamiento]: ...

    def buscar_publicado(self, anuncio_id: str) -> Alojamiento | None: ...


class RepositorioAlojamientosEnMemoria:
    def __init__(self, alojamientos: Sequence[Alojamiento]) -> None:
        self._alojamientos = {alojamiento.id: alojamiento for alojamiento in alojamientos}

    def listar_publicados(self) -> Sequence[Alojamiento]:
        return tuple(self._alojamientos.values())

    def buscar_publicado(self, anuncio_id: str) -> Alojamiento | None:
        return self._alojamientos.get(anuncio_id)

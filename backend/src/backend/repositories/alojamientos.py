from collections.abc import Sequence
from typing import Protocol

from backend.schemas.alojamiento import Alojamiento


class RepositorioAlojamientos(Protocol):
    def listar_publicados(self) -> Sequence[Alojamiento]: ...

    def buscar_publicado(self, anuncio_id: str) -> Alojamiento | None: ...

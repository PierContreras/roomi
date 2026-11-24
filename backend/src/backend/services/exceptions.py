class AlojamientoNoEncontrado(LookupError):
    """El alojamiento solicitado no existe o no está publicado."""


class ResenaPropiaNoPermitida(ValueError):
    """La persona que publicó el alojamiento no puede calificarlo."""

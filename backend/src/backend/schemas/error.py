from pydantic import BaseModel


class ErrorCampo(BaseModel):
    campo: str
    mensaje: str


class ErrorApi(BaseModel):
    codigo: str
    detail: str
    campos: list[ErrorCampo] | None = None

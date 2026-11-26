from contextlib import contextmanager
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.repositories import gestion as repo
from backend.schemas.gestion import (
    Acceso, AnuncioGestionado, Consulta, ConsultaRecibida, Creado,
    Registro, Reporte, Resena, ResenaPublica, Retiro, Sesion, Usuario,
    ResultadoAnuncio, SolicitudAnuncio, Disponibilidad, EstadoConsulta,
)
from backend.services.exceptions import (
    ModeracionNoEncontrada, PublicacionInvalida, ResenaPropiaNoPermitida, TransicionInvalida,
)
from backend.services.seguridad import (
    HASH_FICTICIO, clave_jwt, emitir_token, hash_password, leer_token, necesita_rehash, verifica_password,
)

router = APIRouter()
bearer = HTTPBearer(auto_error=False, bearerFormat="JWT", description="JWT devuelto al iniciar sesión.")
Id = Annotated[str, Path(min_length=1, max_length=100)]
UBICACION = {
    201: {
        "description": "Recurso creado.",
        "headers": {"Location": {"description": "Referencia al recurso creado.", "schema": {"type": "string"}}},
    },
}
PROTEGIDA = {401: {'description': 'Sesión ausente, inválida o vencida.'}, 403: {'description': 'Rol sin permiso.'}}


GESTION = {
    **PROTEGIDA,
    404: {"description": "Recurso inexistente o no disponible para la cuenta."},
    409: {"description": "La acción no está disponible en el estado actual."},
    422: {"description": "Datos de entrada inválidos."},
}


@contextmanager
def errores_gestion():
    try:
        yield
    except ModeracionNoEncontrada:
        raise HTTPException(404, "El recurso no está disponible.") from None
    except TransicionInvalida:
        raise HTTPException(409, "La acción no está disponible en el estado actual.") from None
    except PublicacionInvalida as error:
        raise HTTPException(422, str(error)) from None


def require(*roles):
    def usuario_actual(credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]) -> Usuario:
        row = repo.usuario(leer_token(credentials.credentials)) if credentials else None
        if not row:
            raise HTTPException(401, "Inicia sesión para continuar.", headers={"WWW-Authenticate": "Bearer"})
        if row["role"] not in roles:
            raise HTTPException(403, "Tu cuenta no tiene permiso para esta acción.")
        return Usuario.model_validate(row)

    return Depends(usuario_actual)


cuenta_publica = require("student", "owner")


@router.post("/auth/registro",
    status_code=201,
    tags=["Autenticación"],
    description="Crea una cuenta pública y devuelve su sesión.",
    summary="Crear una cuenta para buscar y publicar",
    responses={**UBICACION, 409: {"description": "Correo ya registrado."}},
)
def registro(data: Registro, response: Response) -> Sesion:
    key = clave_jwt()
    row = repo.inscribir(data.name, data.email, "student", hash_password(data.password))
    if row is None:
        raise HTTPException(409, "Ya existe una cuenta con ese correo.")
    response.headers["Location"] = "/api/auth/perfil"
    return Sesion(token=emitir_token(row["id"], key), user=Usuario.model_validate(row))


@router.post("/auth/login",
    tags=["Autenticación"],
    description="Verifica las credenciales y devuelve la sesión de la cuenta.",
    summary="Obtener un JWT de una hora",
    responses={401: {"description": "Credenciales inválidas."}},
)
def login(data: Acceso) -> Sesion:
    key = clave_jwt()
    row = repo.usuario(data.email, por_correo=True)
    stored = row["password_hash"] if row else HASH_FICTICIO
    valid = verifica_password(data.password, stored)
    if not row or not valid:
        raise HTTPException(401, "El correo o la contraseña no coinciden.", headers={"WWW-Authenticate": "Bearer"})
    if row["role"] not in ("student", "owner"):
        raise HTTPException(403, "Esta cuenta no tiene acceso a ROOMI.")
    if necesita_rehash(stored):
        repo.actualizar_hash(row["id"], stored, hash_password(data.password))
    return Sesion(token=emitir_token(row["id"], key), user=Usuario.model_validate(row))


@router.get(
    "/auth/perfil",
    tags=["Autenticación"],
    summary="Consultar mi perfil",
    description="Devuelve el perfil de la cuenta autenticada, incluido su rol actual.",
    responses=PROTEGIDA,
)
def perfil(user: Usuario = cuenta_publica) -> Usuario:
    return user


@router.get("/propietario/alojamientos",
    tags=["Propietario"],
    description="Incluye los anuncios de la cuenta que siguen disponibles.",
    summary="Listar anuncios propios",
    responses=PROTEGIDA,
)
def anuncios_propios(user: Usuario = cuenta_publica) -> list[AnuncioGestionado]:
    return repo.anuncios(user.id)


@router.get(
    "/propietario/alojamientos/{anuncio_id}",
    tags=["Propietario"],
    summary="Consultar un anuncio propio",
    description="Devuelve la ficha privada del anuncio propio, aunque todavía no esté publicado.",
    responses={**PROTEGIDA, 404: {"description": "Anuncio propio disponible no encontrado."}},
)
def anuncio_propio(anuncio_id: Id, user: Usuario = cuenta_publica) -> AnuncioGestionado:
    anuncio = repo.anuncio_propio(anuncio_id, user.id)
    if anuncio is None:
        raise HTTPException(404, "El anuncio no está disponible.")
    return anuncio


@router.post("/alojamientos", status_code=201, tags=["Alojamientos"],
             responses={**UBICACION, **GESTION}, summary="Guardar un borrador o publicar un anuncio")
def publicar(data: SolicitudAnuncio, response: Response, user: Usuario = cuenta_publica) -> ResultadoAnuncio:
    with errores_gestion():
        resultado = repo.guardar(data, user, borrador=data.borrador)
    response.headers["Location"] = f"/api/propietario/alojamientos/{resultado.id}"
    return resultado


@router.put("/alojamientos/{anuncio_id}", tags=["Alojamientos"], responses=GESTION,
            summary="Actualizar un anuncio propio")
def reemplazar(anuncio_id: Id, data: SolicitudAnuncio, user: Usuario = cuenta_publica) -> ResultadoAnuncio:
    with errores_gestion():
        return repo.guardar(data, user, anuncio_id, borrador=data.borrador)


@router.post("/alojamientos/{anuncio_id}/enviar", tags=["Alojamientos"], responses=GESTION,
             summary="Publicar un borrador")
def enviar(anuncio_id: Id, user: Usuario = cuenta_publica) -> ResultadoAnuncio:
    with errores_gestion():
        return repo.enviar(anuncio_id, user.id, "borrador")


@router.post("/alojamientos/{anuncio_id}/reactivar", tags=["Alojamientos"], responses=GESTION,
             summary="Reactivar un anuncio retirado")
def reactivar(anuncio_id: Id, user: Usuario = cuenta_publica) -> ResultadoAnuncio:
    with errores_gestion():
        return repo.enviar(anuncio_id, user.id, "retirado")


@router.patch("/alojamientos/{anuncio_id}/estado", status_code=204, tags=["Alojamientos"],
              responses=GESTION, summary="Retirar un anuncio publicado")
def retirar(anuncio_id: Id, data: Retiro, user: Usuario = cuenta_publica) -> Response:
    with errores_gestion():
        repo.retirar(anuncio_id, user.id)
    return Response(status_code=204)


@router.delete("/alojamientos/{anuncio_id}", status_code=204, tags=["Alojamientos"],
               responses=GESTION, summary="Eliminar un anuncio propio y conservar su historial")
def eliminar(anuncio_id: Id, user: Usuario = cuenta_publica) -> Response:
    with errores_gestion():
        repo.eliminar(anuncio_id, user.id)
    return Response(status_code=204)


@router.patch("/propietario/alojamientos/{anuncio_id}/disponibilidad", status_code=204,
              tags=["Propietario"], responses=GESTION, summary="Marcar un anuncio como ocupado o disponible")
def disponibilidad(anuncio_id: Id, data: Disponibilidad, user: Usuario = cuenta_publica) -> Response:
    with errores_gestion():
        repo.cambiar_disponibilidad(anuncio_id, user.id, data.ocupado)
    return Response(status_code=204)


@router.get("/propietario/consultas",
    tags=["Contactos"],
    description="Devuelve las consultas recibidas por los anuncios de la cuenta.",
    summary="Leer las consultas de anuncios propios",
    responses=PROTEGIDA,
)
def consultas(user: Usuario = cuenta_publica) -> list[ConsultaRecibida]:
    return repo.consultar_bandeja(user.id)


@router.patch("/propietario/consultas/{consulta_id}", status_code=204,
              tags=["Contactos"], responses=GESTION, summary="Marcar una consulta como pendiente o respondida")
def estado_consulta(consulta_id: Id, data: EstadoConsulta, user: Usuario = cuenta_publica) -> Response:
    with errores_gestion():
        repo.actualizar_consulta(consulta_id, user.id, data.respondida)
    return Response(status_code=204)


@router.post("/alojamientos/{anuncio_id}/consultas",
    status_code=201,
    tags=["Contactos"],
    description="Guarda una consulta con consentimiento para un anuncio público con propietario asignado.",
    summary="Enviar una consulta al propietario",
    dependencies=[cuenta_publica],
    responses={**UBICACION, **PROTEGIDA, 404: {"description": "Anuncio no disponible para consultas."}},
)
def enviar_consulta(anuncio_id: Id, data: Consulta, response: Response) -> Creado:
    item = repo.enviar_consulta(anuncio_id, data)
    if not item:
        raise HTTPException(404, "El anuncio no admite consultas.")
    response.headers["Location"] = f"/api/propietario/consultas#{item}"
    return Creado(id=item)


@router.get("/alojamientos/{anuncio_id}/resenas",
    tags=["Reseñas"],
    description="Devuelve las reseñas visibles. Si el anuncio está oculto o carece de reseñas, devuelve una lista vacía.",
    summary="Listar reseñas públicas",
)
def resenas(anuncio_id: Id) -> list[ResenaPublica]:
    return repo.resenas(anuncio_id)


def registrar_interaccion(anuncio_id, user, data):
    item = repo.agregar_interaccion(anuncio_id, user.id, data)
    if item is None:
        raise HTTPException(404, "El anuncio ya no está disponible.")
    if not item:
        raise HTTPException(409, "Ya registraste esta acción para el anuncio.")
    return Creado(id=item)


@router.post("/alojamientos/{anuncio_id}/resenas",
    status_code=201,
    tags=["Reseñas"],
    description="Guarda una reseña pública por cuenta y anuncio. La cuenta no puede reseñar su propio anuncio.",
    summary="Publicar una reseña",
    responses={**UBICACION, **PROTEGIDA, 404: {"description": "Anuncio público inexistente o no disponible para reseñas de esta cuenta."}, 409: {"description": "Reseña ya registrada."}},
)
def publicar_resena(anuncio_id: Id, data: Resena, response: Response, user: Usuario = cuenta_publica) -> Creado:
    try:
        creado = registrar_interaccion(anuncio_id, user, data)
    except ResenaPropiaNoPermitida:
        raise HTTPException(404, "El anuncio ya no está disponible.") from None
    response.headers["Location"] = f"/api/alojamientos/{anuncio_id}/resenas#{creado.id}"
    return creado


@router.post("/alojamientos/{anuncio_id}/reportes",
    status_code=201,
    tags=["Reportes"],
    description="Guarda un reporte privado por cuenta y anuncio. El anuncio conserva su visibilidad.",
    summary="Registrar un reporte privado",
    responses={**PROTEGIDA, 404: {"description": "Anuncio público no encontrado."}, 409: {"description": "Reporte ya registrado."}},
)
def reportar(anuncio_id: Id, data: Reporte, user: Usuario = cuenta_publica) -> Creado:
    return registrar_interaccion(anuncio_id, user, data)

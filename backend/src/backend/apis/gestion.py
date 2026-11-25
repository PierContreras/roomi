from contextlib import contextmanager
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.repositories import gestion as repo
from backend.schemas.gestion import (
    Acceso, AnuncioGestionado, Consulta, ConsultaRecibida, Creado, Decision,
    Registro, Reporte, ReporteRecibido, Resena, ResenaPublica, Retiro, Sesion, Usuario,
    Motivo, HistorialDecision, ResultadoAnuncio, SolicitudAnuncio,
)
from backend.services.exceptions import (
    ConflictoDeInteres, ModeracionNoEncontrada, ResenaPropiaNoPermitida, TransicionInvalida,
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


MODERACION = {
    **PROTEGIDA,
    404: {"description": "Recurso inexistente o no disponible para la cuenta."},
    409: {"description": "La transición no está permitida o la revisión cambió."},
    422: {"description": "Datos de entrada inválidos."},
}


@contextmanager
def errores_moderacion():
    try:
        yield
    except ModeracionNoEncontrada:
        raise HTTPException(404, "El recurso no está disponible.") from None
    except TransicionInvalida:
        raise HTTPException(409, "La acción no está disponible en el estado actual.") from None
    except ConflictoDeInteres:
        raise HTTPException(403, "conflicto_de_interes") from None


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
titular = require("student", "owner", "admin")
administrador = require("admin")


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
def perfil(user: Usuario = require("student", "owner", "admin")) -> Usuario:
    return user


@router.get("/propietario/alojamientos",
    tags=["Propietario"],
    description="Incluye los anuncios de la cuenta que siguen disponibles.",
    summary="Listar anuncios propios",
    responses=PROTEGIDA,
)
def anuncios_propios(user: Usuario = titular) -> list[AnuncioGestionado]:
    return repo.anuncios(user.id)


@router.get(
    "/propietario/alojamientos/{anuncio_id}",
    tags=["Propietario"],
    summary="Consultar un anuncio propio",
    description="Devuelve la ficha privada del anuncio propio, aunque todavía no esté publicado.",
    responses={**PROTEGIDA, 404: {"description": "Anuncio propio disponible no encontrado."}},
)
def anuncio_propio(anuncio_id: Id, user: Usuario = titular) -> AnuncioGestionado:
    anuncio = repo.anuncio_propio(anuncio_id, user.id)
    if anuncio is None:
        raise HTTPException(404, "El anuncio no está disponible.")
    return anuncio


@router.post("/alojamientos", status_code=201, tags=["Alojamientos"],
             responses={**UBICACION, **MODERACION}, summary="Crear un borrador o evaluar su publicación")
def publicar(data: SolicitudAnuncio, response: Response, user: Usuario = titular) -> ResultadoAnuncio:
    with errores_moderacion():
        resultado = repo.guardar(data, user, borrador=data.borrador)
    response.headers["Location"] = f"/api/propietario/alojamientos/{resultado.id}"
    return resultado


@router.put("/alojamientos/{anuncio_id}", tags=["Alojamientos"], responses=MODERACION,
            summary="Actualizar un anuncio propio")
def reemplazar(anuncio_id: Id, data: SolicitudAnuncio, user: Usuario = titular) -> ResultadoAnuncio:
    with errores_moderacion():
        return repo.guardar(data, user, anuncio_id, borrador=data.borrador)


@router.post("/alojamientos/{anuncio_id}/enviar", tags=["Alojamientos"], responses=MODERACION,
             summary="Enviar un borrador a evaluación")
def enviar(anuncio_id: Id, user: Usuario = titular) -> ResultadoAnuncio:
    with errores_moderacion():
        return repo.enviar(anuncio_id, user.id, "borrador")


@router.post("/alojamientos/{anuncio_id}/reactivar", tags=["Alojamientos"], responses=MODERACION,
             summary="Reevaluar un anuncio retirado")
def reactivar(anuncio_id: Id, user: Usuario = titular) -> ResultadoAnuncio:
    with errores_moderacion():
        return repo.enviar(anuncio_id, user.id, "retirado")


@router.patch("/alojamientos/{anuncio_id}/estado", status_code=204, tags=["Alojamientos"],
              responses=MODERACION, summary="Retirar un anuncio publicado")
def retirar(anuncio_id: Id, data: Retiro, user: Usuario = titular) -> Response:
    with errores_moderacion():
        repo.retirar(anuncio_id, user.id)
    return Response(status_code=204)


@router.delete("/alojamientos/{anuncio_id}", status_code=204, tags=["Alojamientos"],
               responses=MODERACION, summary="Eliminar un anuncio propio y conservar su historial")
def eliminar(anuncio_id: Id, user: Usuario = titular) -> Response:
    with errores_moderacion():
        repo.eliminar(anuncio_id, user.id)
    return Response(status_code=204)


@router.get("/propietario/consultas",
    tags=["Contactos"],
    description="Devuelve las consultas recibidas por los anuncios de la cuenta.",
    summary="Leer las consultas de anuncios propios",
    responses=PROTEGIDA,
)
def consultas(user: Usuario = cuenta_publica) -> list[ConsultaRecibida]:
    return repo.consultar_bandeja(user.id)


@router.get("/administracion/alojamientos", tags=["Administración"], responses=MODERACION,
            summary="Listar anuncios en revisión")
def cola(user: Usuario = administrador) -> list[AnuncioGestionado]:
    return repo.anuncios()


@router.patch("/administracion/alojamientos/{anuncio_id}", status_code=204,
              tags=["Administración"], responses=MODERACION, summary="Decidir una revisión vigente")
def revisar(anuncio_id: Id, data: Decision, user: Usuario = administrador) -> Response:
    with errores_moderacion():
        repo.moderar(anuncio_id, user.id, data)
    return Response(status_code=204)


@router.get("/administracion/alojamientos/{anuncio_id}/historial", tags=["Administración"],
            responses=MODERACION, summary="Consultar el historial de decisiones")
def historial(anuncio_id: Id, user: Usuario = administrador) -> list[HistorialDecision]:
    with errores_moderacion():
        return repo.historial(anuncio_id)


@router.post("/administracion/propietarios/{propietario_id}/suspender", status_code=204,
             tags=["Administración"], responses=MODERACION, summary="Suspender un propietario")
def suspender(propietario_id: Id, data: Motivo, user: Usuario = administrador) -> Response:
    with errores_moderacion():
        repo.suspension(propietario_id, user.id, data.note)
    return Response(status_code=204)


@router.post("/administracion/propietarios/{propietario_id}/levantar-suspension", status_code=204,
             tags=["Administración"], responses=MODERACION, summary="Levantar la suspensión de un propietario")
def levantar_suspension(propietario_id: Id, data: Motivo, user: Usuario = administrador) -> Response:
    with errores_moderacion():
        repo.suspension(propietario_id, user.id, data.note, levantar=True)
    return Response(status_code=204)


@router.get("/administracion/reportes",
    tags=["Administración"],
    description="Devuelve los reportes privados recibidos por administración.",
    summary="Listar reportes de usuarios",
    responses=PROTEGIDA,
)
def reportes(user: Usuario = require("admin")) -> list[ReporteRecibido]:
    return repo.reportes()


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
    description="Guarda un reporte privado por cuenta y anuncio para revisión administrativa.",
    summary="Enviar un reporte privado a administración",
    responses={**UBICACION, **PROTEGIDA, 404: {"description": "Anuncio público no encontrado."}, 409: {"description": "Reporte ya registrado."}},
)
def reportar(anuncio_id: Id, data: Reporte, response: Response, user: Usuario = cuenta_publica) -> Creado:
    creado = registrar_interaccion(anuncio_id, user, data)
    response.headers["Location"] = f"/api/administracion/reportes#{creado.id}"
    return creado

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.repositories import gestion as repo
from backend.schemas.gestion import (
    Acceso, AnuncioGestionado, Borrador, Consulta, ConsultaRecibida, Creado, Decision,
    Registro, Reporte, ReporteRecibido, Resena, ResenaPublica, Retiro, Sesion, Usuario,
)
from backend.services.exceptions import ResenaPropiaNoPermitida
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
    description="Incluye los anuncios pausados de la cuenta. Los eliminados se ocultan.",
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


@router.post("/alojamientos",
    status_code=201,
    tags=["Alojamientos"],
    description="Guarda un borrador propio y lo envía a moderación. La ficha pública requiere aprobación.",
    summary="Crear un anuncio pendiente",
    responses={**UBICACION, **PROTEGIDA},
)
def publicar(data: Borrador, response: Response, user: Usuario = cuenta_publica) -> Creado:
    anuncio_id = repo.guardar(data, user)
    response.headers["Location"] = f"/api/propietario/alojamientos/{anuncio_id}"
    return Creado(id=anuncio_id)


@router.put("/alojamientos/{anuncio_id}",
    tags=["Alojamientos"],
    description="Reemplaza los datos editables de un anuncio propio, incluso si está pausado, y envía una nueva revisión.",
    summary="Reemplazar un anuncio propio y reenviarlo a moderación",
    responses={**PROTEGIDA, 404: {"description": "Anuncio inexistente, no editable o de otro titular."}},
)
def reemplazar(anuncio_id: Id, data: Borrador, user: Usuario = cuenta_publica) -> Creado:
    if not repo.guardar(data, user, anuncio_id):
        raise HTTPException(404, "El anuncio no está disponible para edición.")
    return Creado(id=anuncio_id)


@router.patch("/alojamientos/{anuncio_id}/estado",
    status_code=204,
    tags=["Alojamientos"],
    description="Pausa el anuncio, lo oculta del catálogo y conserva su historial. El propietario puede reenviarlo a revisión.",
    summary="Retirar un anuncio propio y conservar su historial",
    responses={**PROTEGIDA, 404: {"description": "Anuncio inexistente, no retirable o de otro titular."}},
)
def retirar(anuncio_id: Id, data: Retiro, user: Usuario = cuenta_publica) -> Response:
    if not repo.retirar(anuncio_id, user.id):
        raise HTTPException(404, "El anuncio no está disponible para retiro.")
    return Response(status_code=204)


@router.delete(
    "/alojamientos/{anuncio_id}",
    status_code=204,
    tags=["Alojamientos"],
    summary="Eliminar un anuncio propio",
    description="Quita la publicación del catálogo y de Mis anuncios. Conserva su historial asociado.",
    responses={**PROTEGIDA, 404: {"description": "Anuncio propio disponible no encontrado."}},
)
def eliminar(anuncio_id: Id, user: Usuario = cuenta_publica) -> Response:
    if not repo.eliminar(anuncio_id, user.id):
        raise HTTPException(404, "El anuncio no está disponible para eliminación.")
    return Response(status_code=204)


@router.get("/propietario/consultas",
    tags=["Contactos"],
    description="Devuelve las consultas recibidas por los anuncios de la cuenta.",
    summary="Leer las consultas de anuncios propios",
    responses=PROTEGIDA,
)
def consultas(user: Usuario = cuenta_publica) -> list[ConsultaRecibida]:
    return repo.consultar_bandeja(user.id)


@router.get("/administracion/alojamientos",
    tags=["Administración"],
    description="Devuelve los anuncios pendientes y las decisiones visibles para moderación.",
    summary="Listar la cola y las decisiones recientes de los anuncios",
    responses=PROTEGIDA,
)
def cola(user: Usuario = require("admin")) -> list[AnuncioGestionado]:
    return repo.anuncios()


@router.patch("/administracion/alojamientos/{anuncio_id}",
    status_code=204,
    tags=["Administración"],
    description="Aplica una decisión a la revisión pendiente. El rechazo requiere un motivo.",
    summary="Aprobar o rechazar la revisión vigente",
    responses={
        **PROTEGIDA,
        404: {"description": "Anuncio inexistente o eliminado."},
        409: {"description": "Anuncio revisado, pausado o sustituido."},
    },
)
def revisar(anuncio_id: Id, data: Decision, user: Usuario = require("admin")) -> Response:
    resultado = repo.moderar(anuncio_id, user.id, data)
    if resultado is None:
        raise HTTPException(404, "Alojamiento no encontrado.")
    if not resultado:
        raise HTTPException(409, "El anuncio cambió. Vuelve a cargarlo antes de decidir.")
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

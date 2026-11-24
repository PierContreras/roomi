import hashlib
import hmac
import os
import re
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from argon2 import PasswordHasher, Type
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import HTTPException
from jwt.exceptions import InvalidTokenError

_HASHER = PasswordHasher(type=Type.ID)
_SCRYPT = re.compile(r"([0-9a-f]{32}):([0-9a-f]{128})")
_ALGORITMO_JWT = "HS256"
_VIGENCIA = timedelta(hours=1)


def hash_password(password: str) -> str:
    return _HASHER.hash(password)


HASH_FICTICIO = hash_password(secrets.token_urlsafe(32))


def verifica_password(password: str, stored: str) -> bool:
    legacy = _SCRYPT.fullmatch(stored)
    if legacy:
        # El formato anterior guardaba la sal y el digest de scrypt en hexadecimal.
        salt, digest = map(bytes.fromhex, legacy.groups())
        actual = hashlib.scrypt(password.encode(), salt=salt, n=2**15, r=8, p=3, maxmem=64 * 1024**2)
        return hmac.compare_digest(actual, digest)

    try:
        return _HASHER.verify(stored, password)
    except (InvalidHashError, VerificationError):
        return False


def necesita_rehash(stored: str) -> bool:
    return not stored.startswith("$argon2id$") or _HASHER.check_needs_rehash(stored)


def clave_jwt() -> bytes:
    key = os.getenv("ROOMI_JWT_SECRET", "").encode()
    if len(key) < 32:
        raise HTTPException(503, "Configura el secreto de sesión en el servidor.")
    return key


def emitir_token(user_id: str, key: bytes) -> str:
    ahora = datetime.now(UTC)
    return jwt.encode(
        {"sub": user_id, "iat": ahora, "exp": ahora + _VIGENCIA},
        key,
        algorithm=_ALGORITMO_JWT,
    )


def leer_token(token: str) -> str:
    try:
        payload = jwt.decode(
            token, clave_jwt(), algorithms=[_ALGORITMO_JWT],
            options={"require": ["sub", "exp"]},
        )
        return str(UUID(payload["sub"]))
    except (InvalidTokenError, ValueError, TypeError, OverflowError):
        raise HTTPException(401, "Sesión inválida o vencida.", headers={"WWW-Authenticate": "Bearer"}) from None

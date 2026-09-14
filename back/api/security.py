from datetime import datetime, timedelta
from http import HTTPStatus
from secrets import token_urlsafe
from typing import Annotated
from zoneinfo import ZoneInfo
from asyncpg import Connection
from fastapi import Cookie, Depends, HTTPException, Response
from fastapi.security import OAuth2PasswordBearer
from jwt import (
    DecodeError,
    ExpiredSignatureError,
    InvalidTokenError,
    decode,
    encode,
)

from pwdlib import PasswordHash
from api.database import get_db
from api.schemas.enums import TypeUserEnum
from api.schemas.global_schemas import UsuarioLogado
from api.settings import settings

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl='/login/',
    auto_error=False
)
Token = Annotated[str | None, Depends(oauth2_scheme)]
Database = Annotated[Connection, Depends(get_db)]

password_hash = PasswordHash.recommended()

ACCESS_LEVEL_ORDER = {
    TypeUserEnum.ADMIN.value: 1,
    TypeUserEnum.USER.value: 1
}



## USAR O HTTPONLY=TRUE ELIMINA O RISCO DO TOKEN VAZAR POR INTEIRO
## DO LOCAL STORAGE, JÁ QUE DESTE MODO, O JS NÃO LER O TOKEN

## O CSRF É USADO PARA GARANTIR QUE SITES MALICIOSOS NÃO ENVIEM 
## REQUISIÇÕES FALSAS PARA O SITE, JÁ QUE O CSRF PODE SER LIDO
## PELO JS, ENVIANDO PARA O BACK, O HEADER CORRETO

## ACCESS_TOKEN E REFRESH_TOKEN -> ACCESS TOKEN RETORNA O TOKEN 
## DE ACESSO DO USUÁRIO, O REFRESH_TOKEN É USADO PARA QUE EM CASO

## DE VAZAMENTO DE UM TOKEN, OU INVASÃO NO SISTEMA, O ATACANTE
## NÃO TENHA TEMPO LIVRE E LIBERADO NO SISTEMA, JÁ QUE O ACCESS
## TOKEN TEM VIDA CURTA (ALGUNS MINUTOS)


## O GET OPCIONAL CURRENT USER, É USADO PARA NÃO FORÇAR UM 401
## EM CASO DE USUÁRIO NÃO AUTENTICADO

## REQUER_NIVEL_ACESSO SERVE COMO UM FACTORY PARA VALIDAR NA ROTA
## O NÍVEL DE ACESSO DO USUÁRIO LOGADO

def __cooke_domain() -> str | None:
    return settings.COOKIE_DOMAIN or None

def _credentials_exception() -> HTTPException:
    return HTTPException(
        detail='Credenciais Inválidas',
        status_code=HTTPStatus.UNAUTHORIZED,
        headers={'WWW-Authenticate': 'Bearer'}
    )

async def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(tz=ZoneInfo('UTC')) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )

    to_encode.update({'exp': expire, 'token_type': 'access'})

    return encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )

async def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(tz=ZoneInfo('UTC')) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )

    to_encode.update({'exp': expire, 'token_type': 'refresh'})
    return encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str
) -> None:
    cookie_config = {
        'httponly': True,
        'secure': settings.COOKIE_SECURE,
        'samesite': settings.COOKIE_SAMESITE,
        'domain': __cooke_domain(),
        'path': '/',
    }
    response.set_cookie(
        key='access_token',
        value=access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        **cookie_config
    )
    response.set_cookie(
        key='refresh_token',
        value=refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 *60,
        **cookie_config
    )
    response.set_cookie(
        key='csrf_token',
        value=token_urlsafe(32),
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        httponly=False,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=__cooke_domain(),
        path='/',
    )


def delete_auth_cookies(
    response: Response
) -> None:
    cookie_config = {
        'httponly': True,
        'secure': settings.COOKIE_SECURE,
        'samesite': settings.COOKIE_SAMESITE,
        'domain': __cooke_domain(),
        'path': '/',
    }

    response.delete_cookie(key='access_token', **cookie_config)
    response.delete_cookie(key='refresh_token', **cookie_config)
    response.delete_cookie(
        key='csrf_token',
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=__cooke_domain(),
        path='/',
    )

def decode_session_token(token: str) -> dict:
    return decode(token, settings.SECRET_KEY, algorithms=[
        settings.ALGORITHM
    ])

async def get_user_by_email(
    db: Database,
    email: str
) -> UsuarioLogado:
    # 1. TABELA ADMIN → SESSÃO DE ADMINISTRADOR (espelha o login unificado)
    query_admin = '''
    SELECT
        id,
        email,
        type_user_id
    FROM administradores WHERE email = $1
    '''

    admin_record = await db.fetchrow(
        query_admin, email
    )

    if admin_record:
        return UsuarioLogado(
            id=admin_record['id'],
            email=admin_record['email'],
            type_user_id=admin_record['type_user_id'] or 1
        )

    # 2. TABELA USUÁRIOS → SESSÃO DE USUÁRIO (USER)
    query_usuarios = '''
    SELECT
        id,
        nome,
        email,
        type_user_id
    FROM usuarios WHERE email = $1
    '''

    user_record = await db.fetchrow(
        query_usuarios, email
    )

    if not user_record:
        raise _credentials_exception()

    return UsuarioLogado(**dict(user_record))


async def get_current_user(
    db: Database,
    token: Token = None,
    access_token: Annotated[
        str | None, Cookie(alias='access_token')] = None
) -> UsuarioLogado:
    session_token = access_token or token

    if not session_token:
        raise _credentials_exception()

    try:
        payload = decode_session_token(session_token)
        token_type = payload.get('token_type')

        if token_type and token_type != 'access':
            raise _credentials_exception()

        subject_email = payload.get('sub')

        if not subject_email:
            raise _credentials_exception()

    except (DecodeError, ExpiredSignatureError, InvalidTokenError):
        raise _credentials_exception()

    return await get_user_by_email(db, subject_email)


async def get_optional_current_user(
    db: Database,
    token: Token = None,
    access_token: Annotated[
        str | None, Cookie(alias='access_token')
    ] = None
) -> UsuarioLogado | None:

    if not (access_token or token):
        return None

    try:
        return await get_current_user(db, token, access_token)

    except HTTPException as exc:
        if exc.status_code == HTTPStatus.UNAUTHORIZED:
            return None
        raise


def verify_password(plain_password, hashed_password) -> bool:
    return password_hash.verify(plain_password, hashed_password)


def get_password_hash(password) -> str:
    return password_hash.hash(password)

def requer_nivel_acesso(
    nivel_minimo: TypeUserEnum
) -> dict:

    async def verificar(
        current_user: Annotated[dict, Depends(get_current_user)]
    ):
        user_order = ACCESS_LEVEL_ORDER.get(current_user.type_user, 0)        
        required_order = ACCESS_LEVEL_ORDER.get(nivel_minimo.value, 999)

        if user_order < required_order:
            raise HTTPException(
                detail='A ação requer elevação',
                status_code=HTTPStatus.FORBIDDEN
            )

        return current_user
    return verificar
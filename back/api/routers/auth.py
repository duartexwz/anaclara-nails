from http import HTTPStatus
from typing import Annotated

from asyncpg import Connection
from fastapi import (
    APIRouter,
    Cookie,
    Depends,
    HTTPException,
    Request,
    Response,
)
from fastapi.security import OAuth2PasswordRequestForm
from jwt import DecodeError, ExpiredSignatureError, InvalidTokenError

from api.database import get_db
from api.schemas.global_schemas import (
    LoginResponse,
    MeResponse,
    MessageGlobal,
    RefreshRequest,
    UsuarioLogado,
)
from api.schemas.password_reset_schemas import RecuperarSenha, RedefinirSenha
from api.security import (
    create_access_token,
    create_refresh_token,
    decode_session_token,
    delete_auth_cookies,
    get_current_user,
    get_optional_current_user,
    get_user_by_email,
)
from api.services.token_services import TokenServices

router = APIRouter(prefix='/login', tags=['login'])

token_services = TokenServices()

T_Session = Annotated[Connection, Depends(get_db)]
T_CurrentUser = Annotated[UsuarioLogado, Depends(get_current_user)]
T_OptionalCurrentUser = Annotated[
    UsuarioLogado | None, Depends(get_optional_current_user)
]

@router.post(
    '/',
    summary='Autenticar usuário',
    response_model=LoginResponse
)
@router.post(
    '',
    include_in_schema=False,
)
async def login(
    db: T_Session,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()]
):
    resultado = await token_services.login_for_access_token(
        db=db, form_data=form_data
    )

    # SESSÃO POR ABA: tokens vão no corpo (sessionStorage do front);
    # nenhum cookie é gravado, então janelas não compartilham sessão.
    return {
        'user': resultado['user'],
        'access_token': resultado['access_token'],
        'refresh_token': resultado['refresh_token'],
    }

@router.get(
    '/auth/me',
    summary='Retorna o usuário autenticado',
    response_model=MeResponse
)
async def me(current_user: T_CurrentUser):
    return {'user': current_user}


@router.post(
    '/auth/refresh',
    summary='Renovar Sessão',
    response_model=LoginResponse,
)
@router.post(
    '/auth/refresh/',
    response_model=LoginResponse,
    include_in_schema=False,
)
async def refresh_session(
    db: T_Session,
    dados: RefreshRequest | None = None,
    refresh_token: Annotated[
        str | None, Cookie(alias='refresh_token')
    ] = None
):
    # SESSÃO POR ABA: prefere o refresh token do corpo; o cookie segue
    # aceito por compatibilidade com sessões antigas.
    subject_token = (
        dados.refresh_token if dados and dados.refresh_token else None
    ) or refresh_token
    if not subject_token:
        raise HTTPException(
            detail='Refresh token ausente',
            status_code=HTTPStatus.UNAUTHORIZED
        )

    try:
        payload = decode_session_token(subject_token)
        if payload.get('token_type') != 'refresh':
            raise HTTPException(
                detail='Refresh token inválido',
                status_code=HTTPStatus.UNAUTHORIZED
            )

        subject_email = payload.get('sub')
        if not subject_email:
            raise HTTPException(
                detail='Refresh token inválido',
                status_code=HTTPStatus.UNAUTHORIZED
            )

    except (DecodeError, ExpiredSignatureError, InvalidTokenError):
        raise HTTPException(
            detail='Refresh token inválido ou expirado',
            status_code=HTTPStatus.UNAUTHORIZED
        )

    user = await get_user_by_email(db, subject_email)
    access_token = await create_access_token(
        data={
            'sub': user.email,
            'type_user_id': user.type_user_id
        }
    )

    new_refresh_token = await create_refresh_token(
        data={
            'sub': user.email,
            'type_user_id': user.type_user_id
        }
    )

    # SESSÃO POR ABA: par novo vai no corpo; sem cookies novos.
    return {
        'user': user,
        'access_token': access_token,
        'refresh_token': new_refresh_token,
    }

@router.post(
    '/logout/',
    summary='Encerrar Sessão',
    response_model=MessageGlobal
)
@router.post(
    '/logout',
    include_in_schema=False,
)
async def logout(
    request: Request,
    response: Response,
    db: T_Session,
    current_user: T_OptionalCurrentUser
):
    delete_auth_cookies(response)
    return {'message': 'Sessão encerrada com sucesso'}

@router.post(
    '/recuperar/',
    summary='Solicitar redefinição de senha (RF03)',
    status_code=HTTPStatus.ACCEPTED,
    response_model=MessageGlobal
)
@router.post(
    '/recuperar',
    status_code=HTTPStatus.ACCEPTED,
    include_in_schema=False,
)
async def recuperar_senha(
    dados: RecuperarSenha,
    db: T_Session,
):
    return await token_services.solicitar_recuperacao(
        db=db, dados=dados
    )


@router.post(
    '/redefinir/',
    summary='Redefinir senha com token (RF03)',
    status_code=HTTPStatus.OK,
    response_model=MessageGlobal
)
@router.post(
    '/redefinir',
    include_in_schema=False,
)
async def redefinir_senha(
    dados: RedefinirSenha,
    db: T_Session,
):
    return await token_services.redefinir_senha(
        db=db, dados=dados
    )

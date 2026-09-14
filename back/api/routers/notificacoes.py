from http import HTTPStatus
from typing import Annotated

from asyncpg import Connection
from fastapi import APIRouter, Depends

from api.database import get_db
from api.schemas.global_schemas import MessageGlobal, UsuarioLogado
from api.schemas.notificacoes_schemas import (
    NotificacaoFilter,
    NotificacaoList,
    NotificacaoResponse,
)
from api.security import get_current_user
from api.services.notificacoes_services import NotificacoesServices

notificacoes_services = NotificacoesServices()


T_CurrentUser = Annotated[UsuarioLogado, Depends(get_current_user)]
T_Filter = Annotated[NotificacaoFilter, Depends()]
T_Session = Annotated[Connection, Depends(get_db)]


router = APIRouter(
    prefix='/notificacoes',
    tags=['notificacoes']
)

@router.get(
    '/',
    summary='Listar notificações do painel',
    status_code=HTTPStatus.OK,
    response_model=NotificacaoList
)

async def get_notificacoes(
    filtrar: T_Filter,
    db: T_Session,
    current_user: T_CurrentUser
):
    resultado = await notificacoes_services.get_notificacoes(
        db=db, filtrar=filtrar,
        current_user=current_user
    )
    return {'notificacoes': resultado}

@router.patch(
    '/{notificacao_id}/lida',
    summary='Marcar notificação como lida',
    status_code=HTTPStatus.OK,
    response_model=NotificacaoResponse
)

async def marcar_lida(
    db: T_Session,
    notificacao_id: int,
    current_user: T_CurrentUser
):
    return await notificacoes_services.marcar_lida(
        db=db, notificacao_id=notificacao_id,
        current_user=current_user
    )

@router.patch(
    '/lidas',
    summary='Marcar todas as notificações como lidas',
    status_code=HTTPStatus.OK,
    response_model=MessageGlobal
)

async def marcar_todas_lidas(
    db: T_Session,
    current_user: T_CurrentUser
):
    return await notificacoes_services.marcar_todas_lidas(
        db=db, current_user=current_user
    )

from http import HTTPStatus
from typing import Annotated

from asyncpg import Connection
from fastapi import APIRouter, Depends

from api.database import get_db
from api.schemas.global_schemas import UsuarioLogado
from api.schemas.mensagens_schemas import (
    MensagemBase,
    MensagemFilter,
    MensagemList,
    MensagemResponse,
    MensagemUpdate,
)
from api.security import get_current_user
from api.services.mensagens_services import MensagensServices

mensagens_services = MensagensServices()


T_CurrentUser = Annotated[UsuarioLogado, Depends(get_current_user)]
T_Filter = Annotated[MensagemFilter, Depends()]
T_Session = Annotated[Connection, Depends(get_db)]


router = APIRouter(
    prefix='/mensagens',
    tags=['mensagens']
)

@router.post(
    '',
    summary='Enviar mensagem (admin ⇄ cliente)',
    status_code=HTTPStatus.CREATED,
    response_model=MensagemResponse
)
async def create_mensagem(
    mensagem: MensagemBase,
    db: T_Session,
    current_user: T_CurrentUser
):
    return await mensagens_services.create_mensagem(
        db=db, mensagem=mensagem,
        current_user=current_user
    )

@router.get(
    '',
    summary='Listar mensagens',
    status_code=HTTPStatus.OK,
    response_model=MensagemList
)

async def get_mensagens(
    filtrar: T_Filter,
    db: T_Session,
    current_user: T_CurrentUser
):
    resultado = await mensagens_services.get_mensagens(
        db=db, filtrar=filtrar,
        current_user=current_user
    )
    return {'mensagens': resultado}

@router.patch(
    '/{mensagem_id}',
    summary='Marcar mensagem como lida',
    status_code=HTTPStatus.OK,
    response_model=MensagemResponse
)

async def update_mensagem(
    db: T_Session,
    mensagem_id: int,
    mensagem: MensagemUpdate,
    current_user: T_CurrentUser
):
    return await mensagens_services.update_mensagem(
        db=db, mensagem_id=mensagem_id,
        mensagem=mensagem, current_user=current_user
    )

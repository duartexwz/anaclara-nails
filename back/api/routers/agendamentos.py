from http import HTTPStatus
from typing import Annotated

from asyncpg import Connection
from fastapi import APIRouter, Depends

from api.database import get_db
from api.schemas.agendamentos_schemas import (
    AgenamentoBase,
    AgendamentoFilter,
    AgendamentoList,
    AgendamentoResponse,
    AgendamentoUpdate,
)
from api.schemas.global_schemas import MessageGlobal, UsuarioLogado
from api.security import get_current_user
from api.services.agendamentos_services import AgendamentosServices

agendamentos_services = AgendamentosServices()


T_CurrentUser = Annotated[UsuarioLogado, Depends(get_current_user)]
T_Filter = Annotated[AgendamentoFilter, Depends()]
T_Session = Annotated[Connection, Depends(get_db)]


router = APIRouter(
    prefix='/agendamentos',
    tags=['agendamentos']
)

@router.post(
    '/',
    summary='Cadastrar um agendamento',
    status_code=HTTPStatus.CREATED,
    response_model=AgendamentoResponse
)
async def create_agendamento(
    agendamento: AgenamentoBase,
    db: T_Session,
    current_user: T_CurrentUser
):
    return await agendamentos_services.create_agendamento(
        db=db, agendamento=agendamento
    )

@router.get(
    '/',
    summary='Listar agendamentos',
    status_code=HTTPStatus.OK,
    response_model=AgendamentoList
)

async def get_agendamentos(
    filtrar: T_Filter,
    db: T_Session,
    current_user: T_CurrentUser
):
    resultado = await agendamentos_services.get_agendamentos(
        db=db, filtrar=filtrar,
        current_user=current_user
    )
    return {'agendamentos': resultado}


@router.patch(
    '/{agendamento_id}',
    summary='Atualizar os dados do agendamento',
    status_code=HTTPStatus.OK,
    response_model=AgendamentoResponse
)

async def update_agendamento(
    db: T_Session,
    agendamento_id: int,
    agendamento: AgendamentoUpdate,
    current_user: T_CurrentUser
):
    return await agendamentos_services.update_agendamento(
        db=db, agendamento_id=agendamento_id,
        agendamento=agendamento, current_user=current_user
    )

@router.delete(
    '/{agendamento_id}',
    summary='Deletar um agendamento',
    status_code=HTTPStatus.OK,
    response_model=MessageGlobal
)

async def delete_agendamento(
    db: T_Session,
    agendamento_id: int,
    current_user: T_CurrentUser
):
    return await agendamentos_services.delete_agendamento(
        db=db, agendamento_id=agendamento_id,
        current_user=current_user
    )

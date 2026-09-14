from http import HTTPStatus
from typing import Annotated

from asyncpg import Connection
from fastapi import APIRouter, Depends

from api.database import get_db
from api.schemas.global_schemas import MessageGlobal, UsuarioLogado
from api.schemas.programacao_semanal_schemas import (
    ProgramacaoSemanalBase,
    ProgramacaoSemanalFilter,
    ProgramacaoSemanalList,
    ProgramacaoSemanalResponse,
    ProgramacaoSemanalUpdate,
)
from api.security import get_current_user
from api.services.programacao_semanal_services import ProgramacaoSemanalServices

programacao_semanal_services = ProgramacaoSemanalServices()


T_CurrentUser = Annotated[UsuarioLogado, Depends(get_current_user)]
T_Filter = Annotated[ProgramacaoSemanalFilter, Depends()]
T_Session = Annotated[Connection, Depends(get_db)]


router = APIRouter(
    prefix='/programacao-semanal',
    tags=['programacao-semanal']
)

@router.post(
    '/',
    summary='Cadastrar uma programação semanal',
    status_code=HTTPStatus.CREATED,
    response_model=ProgramacaoSemanalResponse
)
async def create_programacao_semanal(
    programacao_semanal: ProgramacaoSemanalBase,
    db: T_Session,
    current_user: T_CurrentUser
):
    return await programacao_semanal_services.create_programacao_semanal(
        db=db, programacao_semanal=programacao_semanal,
        current_user=current_user
    )

@router.get(
    '/',
    summary='Listar programação semanal',
    status_code=HTTPStatus.OK,
    response_model=ProgramacaoSemanalList
)

async def get_programacao_semanal(
    filtrar: T_Filter,
    db: T_Session,
):
    resultado = await programacao_semanal_services.get_programacao_semanal(
        db=db, filtrar=filtrar
    )
    return {'programacoes_semanais': resultado}


@router.patch(
    '/{programacao_semanal_id}',
    summary='Atualizar os dados da programação semanal',
    status_code=HTTPStatus.OK,
    response_model=ProgramacaoSemanalResponse
)

async def update_programacao_semanal(
    db: T_Session,
    programacao_semanal_id: int,
    programacao_semanal: ProgramacaoSemanalUpdate,
    current_user: T_CurrentUser
):
    return await programacao_semanal_services.update_programacao_semanal(
        db=db, programacao_semanal_id=programacao_semanal_id,
        programacao_semanal=programacao_semanal,
        current_user=current_user
    )

@router.delete(
    '/{programacao_semanal_id}',
    summary='Deletar uma programação semanal',
    status_code=HTTPStatus.OK,
    response_model=MessageGlobal
)

async def delete_programacao_semanal(
    db: T_Session,
    programacao_semanal_id: int,
    current_user: T_CurrentUser
):
    return await programacao_semanal_services.delete_programacao_semanal(
        db=db, programacao_semanal_id=programacao_semanal_id,
        current_user=current_user
    )

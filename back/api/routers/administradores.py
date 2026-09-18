from http import HTTPStatus
from typing import Annotated

from asyncpg import Connection
from fastapi import APIRouter, Depends

from api.database import get_db
from api.schemas.administradores_schemas import (
    AdministradorBase,
    AdministradorFilter,
    AdministradorList,
    AdministradorResponse,
    AdministradorUpdate,
)
from api.schemas.global_schemas import MessageGlobal, UsuarioLogado
from api.security import get_current_user
from api.services.administradores_services import AdministradoresServices

administradores_services = AdministradoresServices()


T_CurrentUser = Annotated[UsuarioLogado, Depends(get_current_user)]
T_Filter = Annotated[AdministradorFilter, Depends()]
T_Session = Annotated[Connection, Depends(get_db)]


router = APIRouter(
    prefix='/administradores',
    tags=['administradores']
)

@router.post(
    '',
    summary='Cadastrar um administrador',
    status_code=HTTPStatus.CREATED,
    response_model=AdministradorResponse
)
async def create_administrador(
    administrador: AdministradorBase,
    db: T_Session,
    current_user: T_CurrentUser
):
    return await administradores_services.create_administrador(
        db=db, current_user=current_user,
        administradores=administrador
    )

@router.get(
    '',
    summary='Listar administradores',
    status_code=HTTPStatus.OK,
    response_model=AdministradorList
)

async def get_administradores(
    filtrar: T_Filter,
    db: T_Session,
    current_user: T_CurrentUser
):
    resultado = await administradores_services.get_administradores(
        db=db, filtrar=filtrar,
        current_user=current_user
    )
    return {'administradores': resultado}


@router.patch(
    '/{administrador_id}',
    summary='Atualizar os dados do administrador',
    status_code=HTTPStatus.OK,
    response_model=AdministradorResponse
)

async def update_administrador(
    db: T_Session,
    administrador_id: int,
    administrador: AdministradorUpdate,
    current_user: T_CurrentUser
):
    return await administradores_services.update_administrador(
        db=db, administrador_id=administrador_id,
        administrador=administrador, current_user=current_user
    )

@router.delete(
    '/{administrador_id}',
    summary='Deletar um administrador',
    status_code=HTTPStatus.OK,
    response_model=MessageGlobal
)

async def delete_administrador(
    db: T_Session,
    administrador_id: int,
    current_user: T_CurrentUser
):
    return await administradores_services.delete_administrador(
        db=db, administrador_id=administrador_id,
        current_user=current_user
    )

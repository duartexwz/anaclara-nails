from http import HTTPStatus
from typing import Annotated

from asyncpg import Connection
from fastapi import APIRouter, Depends

from api.database import get_db
from api.schemas.clientes_schemas import (
    ClienteBase,
    ClienteFilter,
    ClienteList,
    ClienteResponse,
    ClienteUpdate,
)
from api.schemas.global_schemas import MessageGlobal, UsuarioLogado
from api.security import get_current_user
from api.services.clientes_services import ClientesServices

clientes_services = ClientesServices()


T_CurrentUser = Annotated[UsuarioLogado, Depends(get_current_user)]
T_Filter = Annotated[ClienteFilter, Depends()]
T_Session = Annotated[Connection, Depends(get_db)]


router = APIRouter(
    prefix='/clientes',
    tags=['clientes']
)

@router.post(
    '',
    summary='Cadastrar um cliente',
    status_code=HTTPStatus.CREATED,
    response_model=ClienteResponse
)
async def create_cliente(
    cliente: ClienteBase,
    db: T_Session,
):
    return await clientes_services.create_cliente(
        db=db, cliente=cliente
    )

@router.get(
    '',
    summary='Listar clientes',
    status_code=HTTPStatus.OK,
    response_model=ClienteList
)

async def get_clientes(
    filtrar: T_Filter,
    db: T_Session,
    current_user: T_CurrentUser
):
    resultado = await clientes_services.get_clientes(
        db=db, filtrar=filtrar,
        current_user=current_user
    )
    return {'clientes': resultado}


@router.patch(
    '/{cliente_id}',
    summary='Atualizar os dados do cliente',
    status_code=HTTPStatus.OK,
    response_model=ClienteResponse
)

async def update_cliente(
    db: T_Session,
    cliente_id: int,
    cliente: ClienteUpdate,
    current_user: T_CurrentUser
):
    return await clientes_services.update_clientes(
        db=db, cliente_id=cliente_id,
        cliente=cliente, current_user=current_user
    )

@router.delete(
    '/{cliente_id}',
    summary='Deletar um cliente',
    status_code=HTTPStatus.OK,
    response_model=MessageGlobal
)

async def delete_cliente(
    db: T_Session,
    cliente_id: int,
    current_user: T_CurrentUser
):
    return await clientes_services.delete_cliente(
        db=db, cliente_id=cliente_id,
        current_user=current_user
    )

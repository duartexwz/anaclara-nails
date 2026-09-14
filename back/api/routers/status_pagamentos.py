from http import HTTPStatus
from typing import Annotated

from asyncpg import Connection
from fastapi import APIRouter, Depends

from api.database import get_db
from api.schemas.global_schemas import MessageGlobal, UsuarioLogado
from api.schemas.status_pagamentos_schemas import (
    StatusPagamentoBase,
    StatusPagamentoFilter,
    StatusPagamentoList,
    StatusPagamentoResponse,
    StatusPagamentoUpdate,
)
from api.security import get_current_user
from api.services.status_pagamentos_services import StatusPagamentosServices

status_pagamentos_services = StatusPagamentosServices()


T_CurrentUser = Annotated[UsuarioLogado, Depends(get_current_user)]
T_Filter = Annotated[StatusPagamentoFilter, Depends()]
T_Session = Annotated[Connection, Depends(get_db)]


router = APIRouter(
    prefix='/status-pagamentos',
    tags=['status-pagamentos']
)

@router.post(
    '/',
    summary='Cadastrar um status de pagamento',
    status_code=HTTPStatus.CREATED,
    response_model=StatusPagamentoResponse
)
async def create_status_pagamento(
    status_pagamento: StatusPagamentoBase,
    db: T_Session,
    current_user: T_CurrentUser
):
    return await status_pagamentos_services.create_status_pagamento(
        db=db, status_pagamento=status_pagamento,
        current_user=current_user
    )

@router.get(
    '/',
    summary='Listar status de pagamentos',
    status_code=HTTPStatus.OK,
    response_model=StatusPagamentoList
)

async def get_status_pagamentos(
    filtrar: T_Filter,
    db: T_Session,
    current_user: T_CurrentUser
):
    resultado = await status_pagamentos_services.get_status_pagamentos(
        db=db, filtrar=filtrar,
        current_user=current_user
    )
    return {'status_pagamentos': resultado}


@router.patch(
    '/{status_pagamento_id}',
    summary='Atualizar os dados do status de pagamento',
    status_code=HTTPStatus.OK,
    response_model=StatusPagamentoResponse
)

async def update_status_pagamento(
    db: T_Session,
    status_pagamento_id: int,
    status_pagamento: StatusPagamentoUpdate,
    current_user: T_CurrentUser
):
    return await status_pagamentos_services.update_status_pagamento(
        db=db, status_pagamento_id=status_pagamento_id,
        status_pagamento=status_pagamento,
        current_user=current_user
    )

@router.delete(
    '/{status_pagamento_id}',
    summary='Deletar um status de pagamento',
    status_code=HTTPStatus.OK,
    response_model=MessageGlobal
)

async def delete_status_pagamento(
    db: T_Session,
    status_pagamento_id: int,
    current_user: T_CurrentUser
):
    return await status_pagamentos_services.delete_status_pagamento(
        db=db, status_pagamento_id=status_pagamento_id,
        current_user=current_user
    )

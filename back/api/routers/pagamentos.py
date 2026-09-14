from http import HTTPStatus
from typing import Annotated

from asyncpg import Connection
from fastapi import APIRouter, Depends, Header, Request

from api.database import get_db
from api.schemas.global_schemas import MessageGlobal, UsuarioLogado
from api.schemas.pagamentos_schemas import (
    PagamentoBrickCreate,
    PagamentoResponse,
    PagamentoStatusResponse,
    WebhookPayload,
)
from api.security import get_current_user
from api.services.pagamentos_services import PagamentosServices
from api.settings import settings

pagamentos_services = PagamentosServices()


T_CurrentUser = Annotated[UsuarioLogado, Depends(get_current_user)]
T_Session = Annotated[Connection, Depends(get_db)]


router = APIRouter(
    prefix='/pagamentos',
    tags=['pagamentos']
)

@router.post(
    '',
    summary='Criar pagamento do sinal via Checkout Bricks',
    status_code=HTTPStatus.CREATED,
    response_model=PagamentoResponse
)
async def create_pagamento(
    pagamento: PagamentoBrickCreate,
    db: T_Session,
    current_user: T_CurrentUser
):
    return await pagamentos_services.criar_pagamento(
        db=db, dados=pagamento
    )

@router.get(
    '/public-key',
    summary='Public Key do Mercado Pago para o Checkout Bricks',
    status_code=HTTPStatus.OK,
)
async def get_public_key():
    return {'public_key': settings.MERCADO_PAGO_PUBLIC_KEY}

@router.get(
    '/{payment_id}',
    summary='Consultar status do pagamento',
    status_code=HTTPStatus.OK,
    response_model=PagamentoStatusResponse
)
async def get_pagamento(
    payment_id: int,
    db: T_Session,
    current_user: T_CurrentUser
):
    return await pagamentos_services.consultar_pagamento(
        db=db, payment_id=payment_id
    )

@router.post(
    '/webhook',
    summary='Webhook do Mercado Pago (atualiza o agendamento)',
    status_code=HTTPStatus.OK,
    response_model=MessageGlobal
)
async def webhook_pagamento(
    request: Request,
    payload: WebhookPayload,
    db: T_Session,
    x_signature: Annotated[str | None, Header(alias='x-signature')] = None,
    x_request_id: Annotated[str | None, Header(alias='x-request-id')] = None
):
    return await pagamentos_services.processar_webhook(
        db=db,
        payload=payload.model_dump(),
        x_signature=x_signature,
        x_request_id=x_request_id,
    )

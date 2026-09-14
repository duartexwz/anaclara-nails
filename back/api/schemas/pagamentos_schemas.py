from typing import Any

from pydantic import BaseModel, Field


class IdentificacaoPagador(BaseModel):
    type: str = Field(examples=['CPF'])
    number: str = Field(examples=['12345678909'])


class PagadorBrick(BaseModel):
    name: str | None = None
    surname: str | None = None
    email: str
    identification: IdentificacaoPagador | None = None


class PagamentoBrickCreate(BaseModel):
    ## DADOS VINDOS DO CHECKOUT BRICKS (PAYMENT BRICK)

    agendamento_id: int
    transaction_amount: float = Field(gt=0)
    token: str | None = None
    issuer_id: str | None = None
    payment_method_id: str = Field(examples=['pix', 'visa'])
    installments: int = Field(default=1, ge=1)
    payer: PagadorBrick
    description: str | None = None


class PagamentoResponse(BaseModel):
    id: int
    status: str
    status_detail: str | None = None
    agendamento_id: int
    status_pagamentos_id: int | None = None
    qr_code: str | None = None
    qr_code_base64: str | None = None
    ticket_url: str | None = None


class PagamentoStatusResponse(BaseModel):
    id: int
    status: str
    status_detail: str | None = None
    agendamento_id: int | None = None


class WebhookPayload(BaseModel):
    action: str | None = None
    api_version: str | None = None
    data: dict[str, Any] = Field(default_factory=dict)
    date_created: str | None = None
    id: int | None = None
    live_mode: bool | None = None
    type: str | None = None
    user_id: int | None = None

import asyncio
import hashlib
import hmac
import uuid
from http import HTTPStatus
from typing import Any

import mercadopago
from asyncpg import Connection
from fastapi import HTTPException

from api.repositories.agendamentos_repository import AgendamentosRepository
from api.schemas.enums import StatusPagamentoEnum
from api.schemas.pagamentos_schemas import PagamentoBrickCreate
from api.settings import settings

## MAPEIA O STATUS DO MERCADO PAGO PARA O NOSSO (RN03)
STATUS_MAP = {
    'approved': StatusPagamentoEnum.PAGO,
    'authorized': StatusPagamentoEnum.PAGO,
    'pending': StatusPagamentoEnum.PENDENTE,
    'in_process': StatusPagamentoEnum.PENDENTE,
    'in_mediation': StatusPagamentoEnum.PENDENTE,
    'rejected': StatusPagamentoEnum.CANCELADO,
    'cancelled': StatusPagamentoEnum.CANCELADO,
    'refunded': StatusPagamentoEnum.CANCELADO,
    'charged_back': StatusPagamentoEnum.CANCELADO,
}


def validar_assinatura_webhook(
    x_signature: str | None,
    x_request_id: str | None,
    data_id: Any,
    secret: str,
) -> bool:
    ## VALIDACAO OFICIAL MP: HMAC SHA256 DE "id:{id};request-id:{rid};ts:{ts};"

    if not x_signature or not x_request_id or data_id is None:
        return False

    partes = dict(
        item.split('=', 1)
        for item in x_signature.split(',')
        if '=' in item
    )
    ts = partes.get('ts', '').strip()
    recebido = partes.get('v1', '').strip()

    if not ts or not recebido:
        return False

    for manifest in (
        f'id:{data_id};request-id:{x_request_id};ts:{ts};',
        f'id:{data_id};request-id:{x_request_id};ts:{ts}',
    ):
        esperado = hmac.new(
            secret.encode(), manifest.encode(), hashlib.sha256
        ).hexdigest()
        if hmac.compare_digest(esperado, recebido):
            return True
    return False


def _normalizar_metodo(payment_method_id: str | None) -> str:
    ## BRICK INFORMA PIX COMO 'bank_transfer'; /v1/payments EXIGE 'pix'
    metodo = (payment_method_id or '').lower()
    return 'pix' if metodo == 'bank_transfer' else payment_method_id or ''


def _notification_url() -> str | None:
    ## MP SÓ ACEITA URL PÚBLICA (https) — LOCALHOST É REJEITADO.
    ## SEM URL VÁLIDA, O STATUS É ACOMPANHADO VIA POLLING.
    base = (settings.APP_PUBLIC_URL or '').rstrip('/')
    if base.startswith('https://'):
        return f'{base}/api/v1/pagamentos/webhook'
    return None


# Cria a classe dos serviços de pagamentos (regras, validações e etc)
class PagamentosServices:
    def __init__(self, sdk_client=None):
        self.agendamentos_repository = AgendamentosRepository()
        self._sdk = sdk_client

    @property
    def sdk(self):
        if self._sdk is None:
            self._sdk = mercadopago.SDK(
                settings.MERCADO_PAGO_ACCESS_TOKEN
            )
        return self._sdk

    def _status_interno(self, mp_status: str) -> StatusPagamentoEnum:
        return STATUS_MAP.get(mp_status, StatusPagamentoEnum.PENDENTE)

    async def _definir_status_agendamento(
        self, db: Connection, agendamento_id: int, mp_status: str
    ) -> int | None:
        interno = self._status_interno(mp_status)
        status_id = await self.agendamentos_repository.buscar_status_id(
            db, interno
        )
        if status_id is None:
            return None
        await self.agendamentos_repository.atualizar(
            db, agendamento_id, {'status_pagamentos_id': status_id}
        )

        # SINAL APROVADO CONFIRMA O AGENDAMENTO (RN03) → AVISA A ADMIN
        if interno == StatusPagamentoEnum.PAGO:
            from api.services.notificacoes_services import (
                disparar_notificacao_admin,
            )
            await disparar_notificacao_admin(
                db,
                'pagamento',
                'Sinal pago com sucesso',
                f'Sinal do agendamento #{agendamento_id} aprovado.',
                agendamento_id,
            )

        return status_id

    def _resposta(self, pagamento: dict, agendamento_id: int,
                  status_id: int | None) -> dict:
        poi = pagamento.get('point_of_interaction') or {}
        tx_data = poi.get('transaction_data') or {}
        return {
            'id': pagamento['id'],
            'status': pagamento.get('status'),
            'status_detail': pagamento.get('status_detail'),
            'agendamento_id': agendamento_id,
            'status_pagamentos_id': status_id,
            'qr_code': tx_data.get('qr_code'),
            'qr_code_base64': tx_data.get('qr_code_base64'),
            'ticket_url': tx_data.get('ticket_url'),
        }

    def _detalhe_erro_mp(self, resp: dict) -> str:
        corpo = resp.get('response') or {}
        if isinstance(corpo, dict):
            return str(corpo.get('message') or corpo)[:300]
        return str(corpo)[:300]

    async def criar_pagamento(
        self, db: Connection, dados: PagamentoBrickCreate
    ) -> dict:
        agendamento = await self.agendamentos_repository.buscar_por_id(
            db, dados.agendamento_id
        )
        if not agendamento:
            raise HTTPException(
                detail='Agendamento não encontrado',
                status_code=HTTPStatus.NOT_FOUND,
            )

        # RN01 - o sinal corresponde a 50% do valor total do serviço
        if abs(float(dados.transaction_amount) - float(
            agendamento['sinal']
        )) > 0.01:
            raise HTTPException(
                detail='O valor deve corresponder ao sinal do agendamento',
                status_code=HTTPStatus.UNPROCESSABLE_ENTITY,
            )

        # PIX EXIGE CPF DO PAGADOR NA API DO MP — SE O BRICK NÃO ENVIOU,
        # USA O CPF JÁ CADASTRADO NO CLIENTE (MEUS DADOS) COMO FALLBACK.
        payer = dados.payer.model_dump(exclude_unset=True)
        if dados.payment_method_id == 'pix' and not payer.get(
            'identification'
        ):
            from api.repositories.clientes_repository import (
                ClientesRepository,
            )

            cliente = await ClientesRepository().buscar_por_id(
                db, agendamento['cliente_id']
            )
            cpf_cliente = (cliente or {}).get('cpf')
            if cpf_cliente:
                payer['identification'] = {
                    'type': 'CPF',
                    'number': cpf_cliente,
                }
        if dados.payment_method_id == 'pix' and not payer.get(
            'identification'
        ):
            raise HTTPException(
                detail='CPF do pagador é obrigatório para Pix',
                status_code=HTTPStatus.UNPROCESSABLE_ENTITY,
            )

        corpo = {
            'transaction_amount': dados.transaction_amount,
            'description': dados.description
            or f"Sinal agendamento #{dados.agendamento_id} - Ana Clara Nails",
            'payment_method_id': _normalizar_metodo(
                dados.payment_method_id
            ),
            'payer': {'email': dados.payer.email, **{
                k: v for k, v in payer.items() if k != 'email'
            }},
            'metadata': {'agendamento_id': dados.agendamento_id},
            'notification_url': _notification_url(),
        }
        if dados.token:
            corpo['token'] = dados.token
            corpo['installments'] = int(dados.installments)
            if dados.issuer_id:
                corpo['issuer_id'] = dados.issuer_id
        corpo = {k: v for k, v in corpo.items() if v is not None}

        # X-Idempotency-Key evita dupla cobrança em reenvio do Brick
        request_options = mercadopago.config.RequestOptions(
            custom_headers={
                'x-idempotency-key':
                    f'agendamento-{dados.agendamento_id}-{uuid.uuid4()}'
            }
        )
        try:
            resp = await asyncio.to_thread(
                self.sdk.payment().create, corpo, request_options
            )
        except Exception as e:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST, detail=str(e)
            ) from e
        if resp.get('status') not in (200, 201):
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=self._detalhe_erro_mp(resp),
            )

        pagamento = resp.get('response', {})
        status_id = await self._definir_status_agendamento(
            db, dados.agendamento_id, pagamento.get('status', '')
        )
        return self._resposta(pagamento, dados.agendamento_id, status_id)

    async def consultar_pagamento(
        self, db: Connection, payment_id: int
    ) -> dict:
        try:
            resp = await asyncio.to_thread(
                self.sdk.payment().get, payment_id
            )
        except Exception as e:
            raise HTTPException(
                status_code=HTTPStatus.BAD_GATEWAY,
                detail=f'Falha ao consultar Mercado Pago: {str(e)[:150]}',
            ) from e
        if resp.get('status') != 200:
            raise HTTPException(
                detail='Pagamento não encontrado no Mercado Pago',
                status_code=HTTPStatus.NOT_FOUND,
            )
        pagamento = resp.get('response', {}) or {}
        meta = pagamento.get('metadata') or {}
        agendamento_id = meta.get('agendamento_id')
        if agendamento_id is None:
            try:
                ref = pagamento.get('external_reference')
                agendamento_id = int(ref) if ref else None
            except (ValueError, TypeError):
                agendamento_id = None

        # POLLING: SE APROVOU, CONFIRMA NA HORA (MESMO EFEITO DO WEBHOOK)
        status_id = None
        if (
            str(pagamento.get('status') or '').lower() == 'approved'
            and agendamento_id is not None
        ):
            status_id = await self._definir_status_agendamento(
                db, int(agendamento_id), 'approved'
            )

        return {
            'id': pagamento['id'],
            'status': pagamento.get('status'),
            'status_detail': pagamento.get('status_detail'),
            'agendamento_id': agendamento_id,
            'status_pagamentos_id': status_id,
        }

    async def processar_webhook(
        self,
        db: Connection,
        payload: dict,
        x_signature: str | None,
        x_request_id: str | None,
    ) -> dict:
        data_id = (payload.get('data') or {}).get('id')

        if not validar_assinatura_webhook(
            x_signature,
            x_request_id,
            data_id,
            settings.MERCADO_PAGO_WEBHOOK_ACESS_TOKEN,
        ):
            raise HTTPException(
                detail='Assinatura do webhook inválida',
                status_code=HTTPStatus.FORBIDDEN,
            )

        # merchant_order NÃO PRECISA VALIDAR NEM PROCESSAR - SÓ CONFIRMA
        tipo = payload.get('type')
        if tipo == 'merchant_order':
            return {'message': 'Evento ignorado'}

        # SÓ INTERESSA NOTIFICAÇÃO DE PAGAMENTO (RN03)
        if tipo not in ('payment', 'payment.created', 'payment.updated'):
            return {'message': 'Evento ignorado'}
        if data_id is None:
            return {'message': 'Evento ignorado'}

        pagamento = await self.consultar_pagamento(db, int(data_id))
        agendamento_id = pagamento.get('agendamento_id')
        if agendamento_id is None:
            return {'message': 'Pagamento sem agendamento vinculado'}

        status_id = pagamento.get('status_pagamentos_id')
        if status_id is None and str(
            pagamento.get('status') or ''
        ).lower() in ('rejected', 'cancelled', 'refunded', 'charged_back'):
            status_id = await self._definir_status_agendamento(
                db, int(agendamento_id), pagamento.get('status', '')
            )

        return {
            'message': 'Agendamento atualizado',
            'agendamento_id': int(agendamento_id),
            'status_pagamentos_id': status_id,
        }

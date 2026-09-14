import hashlib
import hmac
from http import HTTPStatus

import pytest
from fastapi import HTTPException

from api.schemas.pagamentos_schemas import PagamentoBrickCreate
from api.services.pagamentos_services import (
    PagamentosServices,
    validar_assinatura_webhook,
)


class FakePaymentResource:
    ## IMITA sdk.payment() DO MERCADO PAGO

    def __init__(self, create_resp=None, get_resp=None, exc=None):
        self._create_resp = create_resp or {'status': 201, 'response': {}}
        self._get_resp = get_resp or {'status': 200, 'response': {}}
        self._exc = exc
        self.created = []
        self.got = []

    def create(self, body, request_options=None):
        self.created.append((body, request_options))
        if self._exc:
            raise self._exc
        return self._create_resp

    def get(self, payment_id):
        self.got.append(payment_id)
        if self._exc:
            raise self._exc
        return self._get_resp


class FakeSdk:
    def __init__(self, **kwargs):
        self._payment = FakePaymentResource(**kwargs)

    def payment(self):
        return self._payment


AGENDAMENTO = {'id': 10, 'sinal': 50.0}


def brick(**kwargs):
    base = {
        'agendamento_id': 10,
        'transaction_amount': 50.0,
        'payment_method_id': 'visa',
        'installments': 1,
        'token': 'tok-teste',
        'payer': {'email': 'maria.eduarda@email.com'},
    }
    base.update(kwargs)
    return PagamentoBrickCreate(**base)


def pagamento_mp(status='approved', pid=123):
    return {
        'id': pid,
        'status': status,
        'status_detail': 'accredited',
        'metadata': {'agendamento_id': 10},
    }


def resp_mp(status='approved', http_code=201):
    return {'status': http_code, 'response': pagamento_mp(status)}


def svc(sdk):
    return PagamentosServices(sdk_client=sdk)


class TestAssinaturaWebhook:
    def test_valida(self):
        secret = 'segredo'
        manifest = 'id:99;request-id:req-1;ts:123;'
        v1 = hmac.new(
            secret.encode(), manifest.encode(), hashlib.sha256
        ).hexdigest()
        assert validar_assinatura_webhook(
            f'ts=123,v1={v1}', 'req-1', 99, secret
        ) is True

    def test_valida_sem_ponto_e_virgula_final(self):
        secret = 'segredo'
        manifest = 'id:99;request-id:req-1;ts:123'
        v1 = hmac.new(
            secret.encode(), manifest.encode(), hashlib.sha256
        ).hexdigest()
        assert validar_assinatura_webhook(
            f'ts=123,v1={v1}', 'req-1', 99, secret
        ) is True

    def test_rejeita(self):
        assert validar_assinatura_webhook(
            'ts=123,v1=errada', 'req-1', 99, 'segredo'
        ) is False
        assert validar_assinatura_webhook(None, 'req-1', 99, 's') is False


class TestCriarPagamento:
    async def test_agendamento_inexistente_404(self, fake_db):
        fake_db.queue_fetchrow(None)
        with pytest.raises(HTTPException) as exc:
            await svc(FakeSdk()).criar_pagamento(
                fake_db, brick()
            )
        assert exc.value.status_code == HTTPStatus.NOT_FOUND

    async def test_sinal_divergente_422(self, fake_db):
        fake_db.queue_fetchrow(AGENDAMENTO)
        with pytest.raises(HTTPException) as exc:
            await svc(FakeSdk()).criar_pagamento(
                fake_db, brick(transaction_amount=10.0)
            )
        assert exc.value.status_code == HTTPStatus.UNPROCESSABLE_ENTITY

    async def test_pix_sem_cpf_422(self, fake_db):
        fake_db.queue_fetchrow(AGENDAMENTO)
        with pytest.raises(HTTPException) as exc:
            await svc(FakeSdk()).criar_pagamento(
                fake_db, brick(payment_method_id='pix')
            )
        assert exc.value.status_code == HTTPStatus.UNPROCESSABLE_ENTITY

    async def test_bank_transfer_vira_pix(self, fake_db):
        sdk = FakeSdk(create_resp=resp_mp('pending'))
        fake_db.queue_fetchrow(
            AGENDAMENTO, {'id': 1}, {'status_pagamentos_id': 1}
        )
        resultado = await svc(sdk).criar_pagamento(
            fake_db, brick(payment_method_id='bank_transfer')
        )
        corpo = sdk.payment().created[0][0]
        assert corpo['payment_method_id'] == 'pix'
        assert resultado['status'] == 'pending'

    async def test_aprovado_atualiza_para_pago(self, fake_db):
        sdk = FakeSdk(create_resp=resp_mp('approved'))
        fake_db.queue_fetchrow(
            AGENDAMENTO, {'id': 2}, {'status_pagamentos_id': 2}
        )
        resultado = await svc(sdk).criar_pagamento(
            fake_db, brick()
        )
        assert resultado['status'] == 'approved'
        assert resultado['status_pagamentos_id'] == 2
        corpo, options = sdk.payment().created[0]
        assert corpo['payment_method_id'] == 'visa'
        assert corpo['token'] == 'tok-teste'
        assert options is not None

    async def test_pendente_mantem_pendente(self, fake_db):
        sdk = FakeSdk(create_resp=resp_mp('pending'))
        fake_db.queue_fetchrow(
            AGENDAMENTO, {'id': 1}, {'status_pagamentos_id': 1}
        )
        resultado = await svc(sdk).criar_pagamento(
            fake_db, brick()
        )
        assert resultado['status'] == 'pending'
        assert resultado['status_pagamentos_id'] == 1

    async def test_erro_mp_400_com_detalhe(self, fake_db):
        sdk = FakeSdk(
            create_resp={'status': 400, 'response': {'message': 'bad'}}
        )
        fake_db.queue_fetchrow(AGENDAMENTO)
        with pytest.raises(HTTPException) as exc:
            await svc(sdk).criar_pagamento(fake_db, brick())
        assert exc.value.status_code == HTTPStatus.BAD_REQUEST
        assert 'bad' in exc.value.detail

    async def test_excecao_sdk_400(self, fake_db):
        sdk = FakeSdk(exc=RuntimeError('timeout'))
        fake_db.queue_fetchrow(AGENDAMENTO)
        with pytest.raises(HTTPException) as exc:
            await svc(sdk).criar_pagamento(fake_db, brick())
        assert exc.value.status_code == HTTPStatus.BAD_REQUEST


class TestConsultarPagamento:
    async def test_ok_confirma_agendamento(self, fake_db):
        sdk = FakeSdk(get_resp=resp_mp('approved', 200))
        fake_db.queue_fetchrow(
            {'id': 2}, {'status_pagamentos_id': 2}, {'id': 200}
        )
        resultado = await svc(sdk).consultar_pagamento(fake_db, 123)
        assert resultado['status'] == 'approved'
        assert resultado['agendamento_id'] == 10

    async def test_rejeitado_mapeia_cancelado(self, fake_db):
        sdk = FakeSdk(get_resp=resp_mp('rejected', 200))
        fake_db.queue_fetchrow({'id': 3}, {'status_pagamentos_id': 3})
        resultado = await svc(sdk).consultar_pagamento(fake_db, 123)
        assert resultado['status'] == 'rejected'

    async def test_inexistente_404(self, fake_db):
        sdk = FakeSdk(get_resp={'status': 404, 'response': {}})
        with pytest.raises(HTTPException) as exc:
            await svc(sdk).consultar_pagamento(fake_db, 999)
        assert exc.value.status_code == HTTPStatus.NOT_FOUND

    async def test_falha_conexao_502(self, fake_db):
        sdk = FakeSdk(exc=RuntimeError('down'))
        with pytest.raises(HTTPException) as exc:
            await svc(sdk).consultar_pagamento(fake_db, 123)
        assert exc.value.status_code == HTTPStatus.BAD_GATEWAY


class TestWebhook:
    def _assinatura(self, data_id, request_id='req-1'):
        secret = 'x'
        manifest = f'id:{data_id};request-id:{request_id};ts:1;'
        v1 = hmac.new(
            secret.encode(), manifest.encode(), hashlib.sha256
        ).hexdigest()
        return f'ts=1,v1={v1}', secret

    async def test_assinatura_invalida_403(self, fake_db):
        with pytest.raises(HTTPException) as exc:
            await svc(FakeSdk()).processar_webhook(
                fake_db, {'type': 'payment', 'data': {'id': 1}},
                'ts=1,v1=errada', 'req-1',
            )
        assert exc.value.status_code == HTTPStatus.FORBIDDEN

    async def test_merchant_order_ignorado(self, fake_db):
        sig, _ = self._assinatura(1)
        import api.services.pagamentos_services as mod

        real = mod.settings.MERCADO_PAGO_WEBHOOK_ACESS_TOKEN
        mod.settings.MERCADO_PAGO_WEBHOOK_ACESS_TOKEN = 'x'
        try:
            resultado = await svc(FakeSdk()).processar_webhook(
                fake_db, {'type': 'merchant_order', 'data': {'id': 1}},
                sig, 'req-1',
            )
        finally:
            mod.settings.MERCADO_PAGO_WEBHOOK_ACESS_TOKEN = real
        assert resultado == {'message': 'Evento ignorado'}

    async def test_payment_atualiza_agendamento(self, fake_db):
        import api.services.pagamentos_services as mod

        sig, _ = self._assinatura(123)
        sdk = FakeSdk(get_resp=resp_mp('approved', 200))
        fake_db.queue_fetchrow(
            {'id': 2}, {'status_pagamentos_id': 2}, {'id': 201}
        )
        real = mod.settings.MERCADO_PAGO_WEBHOOK_ACESS_TOKEN
        mod.settings.MERCADO_PAGO_WEBHOOK_ACESS_TOKEN = 'x'
        try:
            resultado = await svc(sdk).processar_webhook(
                fake_db,
                {'type': 'payment', 'data': {'id': 123}},
                sig,
                'req-1',
            )
        finally:
            mod.settings.MERCADO_PAGO_WEBHOOK_ACESS_TOKEN = real
        assert resultado['agendamento_id'] == 10
        assert resultado['status_pagamentos_id'] == 2

    async def test_rejected_marca_cancelado(self, fake_db):
        import api.services.pagamentos_services as mod

        sig, _ = self._assinatura(124)
        sdk = FakeSdk(get_resp=resp_mp('rejected', 200))
        fake_db.queue_fetchrow({'id': 3}, {'status_pagamentos_id': 3})
        real = mod.settings.MERCADO_PAGO_WEBHOOK_ACESS_TOKEN
        mod.settings.MERCADO_PAGO_WEBHOOK_ACESS_TOKEN = 'x'
        try:
            resultado = await svc(sdk).processar_webhook(
                fake_db,
                {'type': 'payment', 'data': {'id': 124}},
                sig,
                'req-1',
            )
        finally:
            mod.settings.MERCADO_PAGO_WEBHOOK_ACESS_TOKEN = real
        assert resultado['status_pagamentos_id'] == 3


class TestRotasPagamento:
    async def test_public_key(self, client):
        resposta = await client.get('/api/v1/pagamentos/public-key')
        assert resposta.status_code == 200
        assert 'public_key' in resposta.json()

    async def test_post_201(self, client, fake_db, as_user, monkeypatch):
        import api.routers.pagamentos as router_mod
        from api.services.pagamentos_services import PagamentosServices
        from tests.conftest import CSRF_COOKIES, CSRF_HEADERS

        fake_db.queue_fetchrow(
            AGENDAMENTO,
            {'id': 2},
            {'status_pagamentos_id': 2},
        )
        monkeypatch.setattr(
            router_mod,
            'pagamentos_services',
            PagamentosServices(
                sdk_client=FakeSdk(create_resp=resp_mp('approved'))
            ),
        )
        resposta = await client.post(
            '/api/v1/pagamentos/',
            json={
                'agendamento_id': 10,
                'transaction_amount': 50.0,
                'payment_method_id': 'visa',
                'installments': 1,
                'token': 'tok-teste',
                'payer': {'email': 'maria.eduarda@email.com'},
            },
            headers=CSRF_HEADERS,
            cookies=CSRF_COOKIES,
        )
        assert resposta.status_code == 201
        assert resposta.json()['status'] == 'approved'

    async def test_post_401_anonimo(self, client, as_anon, fake_db):
        from tests.conftest import CSRF_COOKIES, CSRF_HEADERS

        resposta = await client.post(
            '/api/v1/pagamentos/',
            json={
                'agendamento_id': 10,
                'transaction_amount': 50.0,
                'payment_method_id': 'visa',
                'installments': 1,
                'token': 'tok-teste',
                'payer': {'email': 'maria.eduarda@email.com'},
            },
            headers=CSRF_HEADERS,
            cookies=CSRF_COOKIES,
        )
        assert resposta.status_code == 401

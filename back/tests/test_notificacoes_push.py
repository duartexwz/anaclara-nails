from http import HTTPStatus

import pytest
from fastapi import HTTPException

from api.schemas.notificacoes_schemas import NotificacaoFilter
from api.services.notificacoes_services import (
    NotificacoesServices,
    disparar_notificacao_admin,
)
from api.services.push_service import enviar_push_admins, push_configurado
from api.settings import settings
from tests.conftest import CSRF_COOKIES, CSRF_HEADERS


@pytest.fixture
def sem_push(monkeypatch):
    ## ISOLA OS TESTES DO .ENV REAL (QUE TEM VAPID CONFIGURADO)
    monkeypatch.setattr(settings, 'VAPID_PUBLIC_KEY', '')
    monkeypatch.setattr(settings, 'VAPID_PRIVATE_KEY', '')
    monkeypatch.setattr(settings, 'VAPID_SUBJECT', '')
    return settings


class TestNotificacoesServices:
    def setup_method(self):
        self.svc = NotificacoesServices()

    async def test_get_exige_admin_403(self, fake_db, comum_user):
        with pytest.raises(HTTPException) as exc:
            await self.svc.get_notificacoes(
                fake_db, NotificacaoFilter(), comum_user
            )
        assert exc.value.status_code == HTTPStatus.FORBIDDEN

    async def test_get_vazio_200_lista_vazia(self, fake_db, admin_user):
        fake_db.fetch_default = []
        resultado = await self.svc.get_notificacoes(
            fake_db, NotificacaoFilter(), admin_user
        )
        assert resultado == []

    async def test_get_ok(self, fake_db, admin_user):
        fake_db.queue_fetch([{'id': 1, 'lida': False}])
        resultado = await self.svc.get_notificacoes(
            fake_db, NotificacaoFilter(), admin_user
        )
        assert resultado == [{'id': 1, 'lida': False}]

    async def test_marcar_lida_404(self, fake_db, admin_user):
        fake_db.queue_fetchrow(None)
        with pytest.raises(HTTPException) as exc:
            await self.svc.marcar_lida(fake_db, 9, admin_user)
        assert exc.value.status_code == HTTPStatus.NOT_FOUND

    async def test_marcar_lida_ok(self, fake_db, admin_user):
        fake_db.queue_fetchrow(
            {'id': 1, 'lida': False}, {'id': 1, 'lida': True}
        )
        resultado = await self.svc.marcar_lida(
            fake_db, 1, admin_user
        )
        assert resultado['lida'] is True

    async def test_marcar_todas_lidas(self, fake_db, admin_user):
        fake_db.queue_fetch(
            [{'id': 1, 'lida': False}, {'id': 2, 'lida': False}]
        )
        fake_db.queue_fetchrow({'id': 1, 'lida': True})
        fake_db.queue_fetchrow({'id': 2, 'lida': True})
        resultado = await self.svc.marcar_todas_lidas(
            fake_db, admin_user
        )
        assert 'message' in resultado

    async def test_disparar_registra_sem_push_sem_config(self, fake_db):
        ## SEM VAPID CONFIGURADO: GRAVA NO MURAL E NÃO QUEBRA
        fake_db.queue_fetchrow({'id': 50})
        await disparar_notificacao_admin(
            fake_db, 'agendamento', 'Novo agendamento',
            'Agendamento #7 criado.', 7,
        )
        queries = fake_db.queries('fetchrow')
        assert any('INSERT INTO notificacoes' in q for q in queries)

    async def test_registrar_falha_nao_quebra(self, fake_db):
        fake_db.queue_fetchrow(None)
        resultado = await self.svc.registrar(
            fake_db, 'pagamento', 'X', 'Y', None
        )
        assert resultado is None


class TestPushService:
    async def test_sem_config_nao_envia(self, fake_db, sem_push):
        assert push_configurado() is False
        resultado = await enviar_push_admins(
            fake_db, 'T', 'C', None
        )
        assert resultado == {'enviados': 0, 'removidos': 0}
        assert fake_db.calls == []


class TestRotasNotificacoes:
    async def test_get_401_anonimo(self, client, as_anon, fake_db):
        resposta = await client.get('/api/v1/notificacoes')
        assert resposta.status_code == 401

    async def test_get_200(self, client, fake_db, as_admin):
        fake_db.queue_fetch(
            [{
                'id': 1, 'tipo': 'agendamento', 'titulo': 'T',
                'mensagem': 'M', 'agendamento_id': 7, 'lida': False,
            }]
        )
        resposta = await client.get('/api/v1/notificacoes')
        assert resposta.status_code == 200
        assert len(resposta.json()['notificacoes']) == 1

    async def test_marcar_lida_200(self, client, fake_db, as_admin):
        fake_db.queue_fetchrow(
            {'id': 1, 'lida': False},
            {
                'id': 1, 'tipo': 'agendamento', 'titulo': 'T',
                'mensagem': 'M', 'agendamento_id': None, 'lida': True,
            },
        )
        resposta = await client.patch(
            '/api/v1/notificacoes/1/lida',
            headers=CSRF_HEADERS, cookies=CSRF_COOKIES,
        )
        assert resposta.status_code == 200
        assert resposta.json()['lida'] is True

    async def test_marcar_todas_200(self, client, fake_db, as_admin):
        fake_db.queue_fetch([])
        resposta = await client.patch(
            '/api/v1/notificacoes/lidas',
            headers=CSRF_HEADERS, cookies=CSRF_COOKIES,
        )
        assert resposta.status_code == 200


class TestRotasPush:
    async def test_vapid_key_publica(self, client):
        resposta = await client.get('/api/v1/push/vapid-key')
        assert resposta.status_code == 200
        assert 'public_key' in resposta.json()

    async def test_post_sem_config_503(self, client, fake_db, as_admin, sem_push):
        resposta = await client.post(
            '/api/v1/push/subscriptions',
            json={
                'endpoint': 'https://push.teste/x',
                'p256dh': 'p', 'auth': 'a',
            },
            headers=CSRF_HEADERS, cookies=CSRF_COOKIES,
        )
        assert resposta.status_code == 503

    async def test_delete_sem_endpoint_400(
        self, client, fake_db, as_admin
    ):
        resposta = await client.delete(
            '/api/v1/push/subscriptions',
            headers=CSRF_HEADERS, cookies=CSRF_COOKIES,
        )
        assert resposta.status_code == 400

    async def test_delete_200(self, client, fake_db, as_admin):
        fake_db.queue_fetch([{'id': 1}])
        fake_db.queue_fetchrow({'id': 1})
        resposta = await client.delete(
            '/api/v1/push/subscriptions?endpoint=https://push.teste/x',
            headers=CSRF_HEADERS, cookies=CSRF_COOKIES,
        )
        assert resposta.status_code == 200

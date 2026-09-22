from datetime import date, time
from http import HTTPStatus

import pytest
from fastapi import HTTPException

from api.schemas.bloqueios_schemas import BloqueioBase
from api.schemas.clientes_schemas import ClienteUpdate
from api.schemas.mensagens_schemas import MensagemBase
from api.schemas.programacao_semanal_schemas import ProgramacaoSemanalUpdate
from api.services.agendamentos_services import AgendamentosServices
from api.services.bloqueios_services import BloqueiosServices
from api.services.clientes_services import ClientesServices
from api.services.mensagens_services import MensagensServices
from api.services.programacao_semanal_services import (
    ProgramacaoSemanalServices,
)


class TestMoldeCliente:
    def setup_method(self):
        self.svc = ClientesServices()

    async def test_update_molde_ok(self, fake_db, admin_user):
        fake_db.queue_fetchrow(
            {'id': 1}, {'id': 1, 'molde': 'Amendoada M'}
        )
        resultado = await self.svc.update_clientes(
            fake_db, 1, ClienteUpdate(molde='Amendoada M'), admin_user
        )
        assert resultado == {'id': 1, 'molde': 'Amendoada M'}


class TestIntervaloProgramacao:
    def setup_method(self):
        self.svc = ProgramacaoSemanalServices()

    async def test_update_intervalo_ok(self, fake_db, admin_user):
        fake_db.queue_fetchrow({'id': 1}, {'id': 1})
        resultado = await self.svc.update_programacao_semanal(
            fake_db,
            1,
            ProgramacaoSemanalUpdate(intervalo_minutos=60),
            admin_user,
        )
        assert resultado == {'id': 1}


class TestMensagensServices:
    def setup_method(self):
        self.svc = MensagensServices()

    async def test_create_ok(self, fake_db, comum_user):
        fake_db.queue_fetchrow({'id': 9, 'texto': 'Oi'})
        resultado = await self.svc.create_mensagem(
            fake_db,
            MensagemBase(remetente='cliente', texto='Oi'),
            comum_user,
        )
        assert resultado == {'id': 9, 'texto': 'Oi'}

    async def test_create_agendamento_inexistente_404(
        self, fake_db, comum_user
    ):
        fake_db.queue_fetchrow(None)
        with pytest.raises(HTTPException) as exc:
            await self.svc.create_mensagem(
                fake_db,
                MensagemBase(
                    agendamento_id=99, remetente='cliente', texto='Oi'
                ),
                comum_user,
            )
        assert exc.value.status_code == HTTPStatus.NOT_FOUND

    async def test_create_vazia_400(self, fake_db, comum_user):
        with pytest.raises(HTTPException) as exc:
            await self.svc.create_mensagem(
                fake_db,
                MensagemBase(remetente='cliente', texto='   '),
                comum_user,
            )
        assert exc.value.status_code == HTTPStatus.BAD_REQUEST


class TestBloqueiosServices:
    def setup_method(self):
        self.svc = BloqueiosServices()

    async def test_create_ok(self, fake_db, admin_user):
        fake_db.queue_fetchrow({'id': 3})
        resultado = await self.svc.create_bloqueio(
            fake_db,
            BloqueioBase(data=date(2026, 12, 25), motivo='Natal'),
            admin_user,
        )
        assert resultado == {'id': 3}

    async def test_create_exige_admin_403(self, fake_db, comum_user):
        with pytest.raises(HTTPException) as exc:
            await self.svc.create_bloqueio(
                fake_db,
                BloqueioBase(data=date(2026, 12, 25), motivo='Natal'),
                comum_user,
            )
        assert exc.value.status_code == HTTPStatus.FORBIDDEN

    async def test_delete_ok(self, fake_db, admin_user):
        fake_db.queue_fetchrow({'id': 3}, {'id': 3})
        resultado = await self.svc.delete_bloqueio(
            fake_db, 3, admin_user
        )
        assert resultado == {'message': 'Bloqueio deletado com sucesso.'}


class TestAgendamentoDataEDono:
    def setup_method(self):
        self.svc = AgendamentosServices()

    async def test_create_com_data(self, fake_db):
        from api.schemas.agendamentos_schemas import AgenamentoBase as AB

        fake_db.queue_fetchrow(
            {'id': 2, 'valor_total': 100.0}, None, {'id': 5}, {'id': 7}
        )
        resultado = await self.svc.create_agendamento(
            fake_db,
            AB(
                cliente_id=1,
                modelo_id=2,
                horario=time(14, 0),
                sinal=50.0,
                data=date(2026, 9, 20),
            ),
        )
        assert resultado == {'id': 7}

    async def test_delete_dona_permite(self, fake_db, comum_user):
        # comum_user id=2; cliente vinculada via email_id=2
        fake_db.queue_fetchrow(
            {'id': 7, 'cliente_id': 1},
            {'id': 1, 'email_id': 2},
            {'id': 7},
            {'id': 50},
        )
        resultado = await self.svc.delete_agendamento(
            fake_db, 7, comum_user
        )
        assert resultado == {
            'message': 'Agendamento deletado com sucesso.'
        }

    async def test_delete_terceira_negada_403(self, fake_db, comum_user):
        fake_db.queue_fetchrow(
            {'id': 7, 'cliente_id': 1},
            {'id': 1, 'email_id': 999},
        )
        with pytest.raises(HTTPException) as exc:
            await self.svc.delete_agendamento(fake_db, 7, comum_user)
        assert exc.value.status_code == HTTPStatus.FORBIDDEN


class TestRotasNovas:
    async def test_post_mensagem_201(self, client, fake_db, as_user):
        from tests.conftest import CSRF_COOKIES, CSRF_HEADERS

        fake_db.queue_fetchrow(
            {
                'id': 5,
                'agendamento_id': None,
                'remetente': 'cliente',
                'texto': 'Oi',
                'lida': False,
            }
        )
        resposta = await client.post(
            '/api/v1/mensagens',
            json={'remetente': 'cliente', 'texto': 'Oi'},
            headers=CSRF_HEADERS,
            cookies=CSRF_COOKIES,
        )
        assert resposta.status_code == 201

    async def test_post_bloqueio_201(self, client, fake_db, as_admin):
        from tests.conftest import CSRF_COOKIES, CSRF_HEADERS

        fake_db.queue_fetchrow(
            {'id': 3, 'data': '2026-12-25', 'motivo': 'Natal'}
        )
        resposta = await client.post(
            '/api/v1/bloqueios',
            json={'data': '2026-12-25', 'motivo': 'Natal'},
            headers=CSRF_HEADERS,
            cookies=CSRF_COOKIES,
        )
        assert resposta.status_code == 201

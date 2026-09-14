from datetime import time
from http import HTTPStatus

import pytest
from fastapi import HTTPException

from api.schemas.administradores_schemas import (
    AdministradorBase,
    AdministradorFilter,
    AdministradorUpdate,
)
from api.schemas.agendamentos_schemas import (
    AgenamentoBase,
    AgendamentoFilter,
    AgendamentoUpdate,
)
from api.schemas.clientes_schemas import (
    ClienteBase,
    ClienteFilter,
    ClienteUpdate,
)
from api.schemas.modelos_unhas_schemas import (
    ModeloUnhaBase,
    ModeloUnhaFilter,
    ModeloUnhaUpdate,
)
from api.schemas.nails_designs_schemas import (
    NailDesignBase,
    NailDesignFilter,
    NailDesignUpdate,
)
from api.schemas.programacao_semanal_schemas import (
    ProgramacaoSemanalBase,
    ProgramacaoSemanalFilter,
    ProgramacaoSemanalUpdate,
)
from api.schemas.status_pagamentos_schemas import (
    StatusPagamentoBase,
    StatusPagamentoFilter,
    StatusPagamentoUpdate,
)
from api.schemas.usuarios_schemas import (
    UsuarioBase,
    UsuarioFilter,
    UsuarioUpdate,
)
from api.services.administradores_services import AdministradoresServices
from api.services.agendamentos_services import AgendamentosServices
from api.services.clientes_services import ClientesServices
from api.services.modelos_unhas_services import ModelosUnhasServices
from api.services.nail_designs_services import NailDesignsServices
from api.services.programacao_semanal_services import (
    ProgramacaoSemanalServices,
)
from api.services.status_pagamentos_services import StatusPagamentosServices
from api.services.token_services import TokenServices
from api.services.usuarios_services import UsuarioServices


class TestUsuarioServices:
    def setup_method(self):
        self.svc = UsuarioServices()

    async def test_create_ok(self, fake_db):
        fake_db.queue_fetchrow(None, {'id': 1})
        resultado = await self.svc.create_usuario(
            fake_db, UsuarioBase(email='a@mail.com', password='x')
        )
        assert resultado == {'id': 1}

    async def test_create_email_duplicado_409(self, fake_db):
        fake_db.queue_fetchrow({'id': 1})
        with pytest.raises(HTTPException) as exc:
            await self.svc.create_usuario(
                fake_db, UsuarioBase(email='a@mail.com', password='x')
            )
        assert exc.value.status_code == HTTPStatus.CONFLICT

    async def test_create_falha_500(self, fake_db):
        fake_db.queue_fetchrow(None, None)
        with pytest.raises(HTTPException) as exc:
            await self.svc.create_usuario(
                fake_db, UsuarioBase(email='a@mail.com', password='x')
            )
        assert exc.value.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

    async def test_get_404_quando_vazio(self, fake_db):
        fake_db.fetch_default = []
        with pytest.raises(HTTPException) as exc:
            await self.svc.get_usuarios(fake_db, UsuarioFilter())
        assert exc.value.status_code == HTTPStatus.NOT_FOUND

    async def test_get_ok(self, fake_db):
        fake_db.queue_fetch([{'id': 1}])
        assert await self.svc.get_usuarios(fake_db, UsuarioFilter()) == [
            {'id': 1}
        ]

    async def test_update_404(self, fake_db, admin_user):
        fake_db.queue_fetchrow(None)
        with pytest.raises(HTTPException) as exc:
            await self.svc.update_usuarios(
                fake_db, 1, UsuarioUpdate(email='n@mail.com'), admin_user
            )
        assert exc.value.status_code == HTTPStatus.NOT_FOUND

    async def test_update_email_duplicado_409(
        self, fake_db, admin_user
    ):
        fake_db.queue_fetchrow({'id': 1}, {'id': 2})
        with pytest.raises(HTTPException) as exc:
            await self.svc.update_usuarios(
                fake_db, 1, UsuarioUpdate(email='n@mail.com'), admin_user
            )
        assert exc.value.status_code == HTTPStatus.CONFLICT

    async def test_update_sem_campos_400(self, fake_db, admin_user):
        fake_db.queue_fetchrow({'id': 1})
        with pytest.raises(HTTPException) as exc:
            await self.svc.update_usuarios(
                fake_db, 1, UsuarioUpdate(), admin_user
            )
        assert exc.value.status_code == HTTPStatus.BAD_REQUEST

    async def test_update_ok(self, fake_db, admin_user):
        fake_db.queue_fetchrow({'id': 1}, None, {'id': 1})
        resultado = await self.svc.update_usuarios(
            fake_db, 1, UsuarioUpdate(email='n@mail.com'), admin_user
        )
        assert resultado == {'id': 1}

    async def test_create_publico_forca_papel_cliente(self, fake_db):
        from api.schemas.usuarios_schemas import UsuarioBase as UB
        fake_db.queue_fetchrow(None, {'id': 1})
        await self.svc.create_usuario(
            fake_db, UB(email='a@mail.com', password='x', type_user_id=1)
        )
        params = fake_db.args_of(1)
        assert params[-1] == 2
        assert params[1] != 'x'

    async def test_update_troca_papel_negada_para_comum(
        self, fake_db, comum_user
    ):
        from api.schemas.usuarios_schemas import UsuarioUpdate as UU
        fake_db.queue_fetchrow({'id': 2})
        with pytest.raises(HTTPException) as exc:
            await self.svc.update_usuarios(
                fake_db, 2, UU(type_user_id=1), comum_user
            )
        assert exc.value.status_code == HTTPStatus.FORBIDDEN

    async def test_update_troca_papel_permitida_para_admin(
        self, fake_db, admin_user
    ):
        from api.schemas.usuarios_schemas import UsuarioUpdate as UU
        fake_db.queue_fetchrow({'id': 2}, {'id': 2})
        resultado = await self.svc.update_usuarios(
            fake_db, 2, UU(type_user_id=1), admin_user
        )
        assert resultado == {'id': 2}

    async def test_delete_404(self, fake_db, admin_user):
        fake_db.queue_fetchrow(None)
        with pytest.raises(HTTPException) as exc:
            await self.svc.delete_usuario(fake_db, 9, admin_user)
        assert exc.value.status_code == HTTPStatus.NOT_FOUND

    async def test_delete_ok(self, fake_db, admin_user):
        fake_db.queue_fetchrow({'id': 1}, {'id': 1})
        resultado = await self.svc.delete_usuario(
            fake_db, 1, admin_user
        )
        assert resultado['message']


class TestAdministradoresServices:
    def setup_method(self):
        self.svc = AdministradoresServices()

    def base(self):
        return AdministradorBase(
            nome='Ana',
            email='ana@mail.com',
            password='x',
            type_user_id=1,
        )

    async def test_create_exige_admin_403(self, fake_db, comum_user):
        with pytest.raises(HTTPException) as exc:
            await self.svc.create_administrador(
                fake_db, comum_user, self.base()
            )
        assert exc.value.status_code == HTTPStatus.FORBIDDEN

    async def test_create_nome_duplicado_409(self, fake_db, admin_user):
        fake_db.queue_fetchrow({'id': 1})
        with pytest.raises(HTTPException) as exc:
            await self.svc.create_administrador(
                fake_db, admin_user, self.base()
            )
        assert exc.value.status_code == HTTPStatus.CONFLICT

    async def test_create_email_duplicado_409(self, fake_db, admin_user):
        fake_db.queue_fetchrow(None, {'id': 2})
        with pytest.raises(HTTPException) as exc:
            await self.svc.create_administrador(
                fake_db, admin_user, self.base()
            )
        assert exc.value.status_code == HTTPStatus.CONFLICT

    async def test_create_ok(self, fake_db, admin_user):
        fake_db.queue_fetchrow(None, None, {'id': 3})
        resultado = await self.svc.create_administrador(
            fake_db, admin_user, self.base()
        )
        assert resultado == {'id': 3}

    async def test_get_exige_admin_403(self, fake_db, comum_user):
        with pytest.raises(HTTPException) as exc:
            await self.svc.get_administradores(
                fake_db, AdministradorFilter(), comum_user
            )
        assert exc.value.status_code == HTTPStatus.FORBIDDEN

    async def test_update_404(self, fake_db, admin_user):
        fake_db.queue_fetchrow(None)
        with pytest.raises(HTTPException) as exc:
            await self.svc.update_administrador(
                fake_db, 1, AdministradorUpdate(nome='B'), admin_user
            )
        assert exc.value.status_code == HTTPStatus.NOT_FOUND

    async def test_update_sem_campos_400(self, fake_db, admin_user):
        fake_db.queue_fetchrow({'id': 1})
        with pytest.raises(HTTPException) as exc:
            await self.svc.update_administrador(
                fake_db, 1, AdministradorUpdate(), admin_user
            )
        assert exc.value.status_code == HTTPStatus.BAD_REQUEST

    async def test_delete_ok(self, fake_db, admin_user):
        fake_db.queue_fetchrow({'id': 1}, {'id': 1})
        resultado = await self.svc.delete_administrador(
            fake_db, 1, admin_user
        )
        assert 'deletado' in resultado['message']


class TestClientesServices:
    def setup_method(self):
        self.svc = ClientesServices()

    async def test_create_nome_duplicado_409(self, fake_db):
        fake_db.queue_fetchrow({'id': 1})
        with pytest.raises(HTTPException) as exc:
            await self.svc.create_cliente(
                fake_db, ClienteBase(nome='Ana', telefone='111')
            )
        assert exc.value.status_code == HTTPStatus.CONFLICT

    async def test_create_telefone_duplicado_409(self, fake_db):
        fake_db.queue_fetchrow(None, {'id': 2})
        with pytest.raises(HTTPException) as exc:
            await self.svc.create_cliente(
                fake_db, ClienteBase(nome='Bia', telefone='111')
            )
        assert exc.value.status_code == HTTPStatus.CONFLICT

    async def test_get_404(self, fake_db, admin_user):
        fake_db.fetch_default = []
        with pytest.raises(HTTPException) as exc:
            await self.svc.get_clientes(
                fake_db, ClienteFilter(), admin_user
            )
        assert exc.value.status_code == HTTPStatus.NOT_FOUND

    async def test_update_404(self, fake_db, admin_user):
        fake_db.queue_fetchrow(None)
        with pytest.raises(HTTPException) as exc:
            await self.svc.update_clientes(
                fake_db, 1, ClienteUpdate(nome='C'), admin_user
            )
        assert exc.value.status_code == HTTPStatus.NOT_FOUND

    async def test_delete_exige_admin_403(self, fake_db, comum_user):
        with pytest.raises(HTTPException) as exc:
            await self.svc.delete_cliente(fake_db, 1, comum_user)
        assert exc.value.status_code == HTTPStatus.FORBIDDEN

    async def test_delete_ok(self, fake_db, admin_user):
        fake_db.queue_fetchrow({'id': 1}, {'id': 1})
        resultado = await self.svc.delete_cliente(
            fake_db, 1, admin_user
        )
        assert 'deletado' in resultado['message']


MODELO = {'id': 2, 'valor_total': 100.0}
AG_BASE = {
    'cliente_id': 1,
    'modelo_id': 2,
    'horario': time(9, 0),
    'sinal': 50.0,
}
AG_ATUAL = {'id': 1, **AG_BASE}


class TestAgendamentosServices:
    def setup_method(self):
        self.svc = AgendamentosServices()

    async def test_create_ok_com_status_pendente_rn03(self, fake_db):
        fake_db.queue_fetchrow(
            MODELO, None, {'id': 5}, {'id': 7}, {'id': 100}
        )
        resultado = await self.svc.create_agendamento(
            fake_db, AgenamentoBase(**AG_BASE)
        )
        assert resultado == {'id': 7}

    async def test_create_modelo_inexistente_404(self, fake_db):
        fake_db.queue_fetchrow(None)
        with pytest.raises(HTTPException) as exc:
            await self.svc.create_agendamento(
                fake_db, AgenamentoBase(**AG_BASE)
            )
        assert exc.value.status_code == HTTPStatus.NOT_FOUND

    async def test_create_sinal_diferente_de_50_porcento_422(
        self, fake_db
    ):
        fake_db.queue_fetchrow(MODELO)
        dados = {**AG_BASE, 'sinal': 40.0}
        with pytest.raises(HTTPException) as exc:
            await self.svc.create_agendamento(
                fake_db, AgenamentoBase(**dados)
            )
        assert exc.value.status_code == HTTPStatus.UNPROCESSABLE_ENTITY

    async def test_create_horario_ocupado_409(self, fake_db):
        fake_db.queue_fetchrow(MODELO, {'id': 9})
        with pytest.raises(HTTPException) as exc:
            await self.svc.create_agendamento(
                fake_db, AgenamentoBase(**AG_BASE)
            )
        assert exc.value.status_code == HTTPStatus.CONFLICT

    async def test_update_exige_admin_403(self, fake_db, comum_user):
        with pytest.raises(HTTPException) as exc:
            await self.svc.update_agendamento(
                fake_db, 1, AgendamentoUpdate(), comum_user
            )
        assert exc.value.status_code == HTTPStatus.FORBIDDEN

    async def test_update_404(self, fake_db, admin_user):
        fake_db.queue_fetchrow(None)
        with pytest.raises(HTTPException) as exc:
            await self.svc.update_agendamento(
                fake_db, 1, AgendamentoUpdate(sinal=50.0), admin_user
            )
        assert exc.value.status_code == HTTPStatus.NOT_FOUND

    async def test_update_conflito_horario_409(self, fake_db, admin_user):
        fake_db.queue_fetchrow(AG_ATUAL, {'id': 9})
        with pytest.raises(HTTPException) as exc:
            await self.svc.update_agendamento(
                fake_db,
                1,
                AgendamentoUpdate(horario=time(10, 0)),
                admin_user,
            )
        assert exc.value.status_code == HTTPStatus.CONFLICT

    async def test_update_sinal_invalido_422(self, fake_db, admin_user):
        fake_db.queue_fetchrow(AG_ATUAL, MODELO)
        with pytest.raises(HTTPException) as exc:
            await self.svc.update_agendamento(
                fake_db, 1, AgendamentoUpdate(sinal=10.0), admin_user
            )
        assert exc.value.status_code == HTTPStatus.UNPROCESSABLE_ENTITY

    async def test_update_ok(self, fake_db, admin_user):
        fake_db.queue_fetchrow(AG_ATUAL, None, {'id': 1})
        resultado = await self.svc.update_agendamento(
            fake_db,
            1,
            AgendamentoUpdate(horario=time(11, 0)),
            admin_user,
        )
        assert resultado == {'id': 1}

    async def test_delete_agendamento_terceira_403(self, fake_db, comum_user):
        fake_db.queue_fetchrow(
            {'id': 7, 'cliente_id': 1},
            {'id': 1, 'email_id': 999},
        )
        with pytest.raises(HTTPException) as exc:
            await self.svc.delete_agendamento(fake_db, 7, comum_user)
        assert exc.value.status_code == HTTPStatus.FORBIDDEN

    async def test_delete_ok(self, fake_db, admin_user):
        fake_db.queue_fetchrow(AG_ATUAL, {'id': 1}, {'id': 101})
        resultado = await self.svc.delete_agendamento(
            fake_db, 1, admin_user
        )
        assert 'deletado' in resultado['message']


class TestModelosUnhasServices:
    def setup_method(self):
        self.svc = ModelosUnhasServices()

    def base(self):
        return ModeloUnhaBase(
            nome='Chrome',
            valor_total=140.0,
            categoria='Festa',
            descricao='Brilho',
            duracao=time(1, 30),
        )

    async def test_create_exige_admin_403(self, fake_db, comum_user):
        with pytest.raises(HTTPException) as exc:
            await self.svc.create_modelo_unha(
                fake_db, self.base(), comum_user
            )
        assert exc.value.status_code == HTTPStatus.FORBIDDEN

    async def test_create_nome_duplicado_409(self, fake_db, admin_user):
        fake_db.queue_fetchrow({'id': 1})
        with pytest.raises(HTTPException) as exc:
            await self.svc.create_modelo_unha(
                fake_db, self.base(), admin_user
            )
        assert exc.value.status_code == HTTPStatus.CONFLICT

    async def test_get_ok(self, fake_db):
        fake_db.queue_fetch([{'id': 1}])
        assert await self.svc.get_modelos_unhas(
            fake_db, ModeloUnhaFilter()
        ) == [{'id': 1}]

    async def test_update_nome_de_outro_modelo_409(
        self, fake_db, admin_user
    ):
        fake_db.queue_fetchrow({'id': 1}, {'id': 2})
        with pytest.raises(HTTPException) as exc:
            await self.svc.update_modelo_unha(
                fake_db, 1, ModeloUnhaUpdate(nome='X'), admin_user
            )
        assert exc.value.status_code == HTTPStatus.CONFLICT

    async def test_delete_ok(self, fake_db, admin_user):
        fake_db.queue_fetchrow({'id': 1}, {'id': 1})
        resultado = await self.svc.delete_modelo_unha(
            fake_db, 1, admin_user
        )
        assert 'deletado' in resultado['message']


class TestNailDesignsServices:
    def setup_method(self):
        self.svc = NailDesignsServices()

    async def test_create_cpf_duplicado_409(self, fake_db, admin_user):
        fake_db.queue_fetchrow({'id': 1})
        with pytest.raises(HTTPException) as exc:
            await self.svc.create_nail_design(
                fake_db,
                NailDesignBase(nome='A', cpf='1', telefone='2'),
                admin_user,
            )
        assert exc.value.status_code == HTTPStatus.CONFLICT

    async def test_update_404(self, fake_db, admin_user):
        fake_db.queue_fetchrow(None)
        with pytest.raises(HTTPException) as exc:
            await self.svc.update_nail_design(
                fake_db, 1, NailDesignUpdate(nome='B'), admin_user
            )
        assert exc.value.status_code == HTTPStatus.NOT_FOUND

    async def test_delete_exige_admin_403(self, fake_db, comum_user):
        with pytest.raises(HTTPException) as exc:
            await self.svc.delete_nail_design(fake_db, 1, comum_user)
        assert exc.value.status_code == HTTPStatus.FORBIDDEN


class TestProgramacaoSemanalServices:
    def setup_method(self):
        self.svc = ProgramacaoSemanalServices()

    def base(self):
        return ProgramacaoSemanalBase(
            profissional_id=1,
            dia_semana='Segunda',
            ativo=True,
            inicio_expediente='09:00',
            fim_expediente='18:00',
            pausa_duracao=time(1, 0),
        )

    async def test_create_dia_duplicado_409(self, fake_db, admin_user):
        fake_db.queue_fetchrow({'id': 1})
        with pytest.raises(HTTPException) as exc:
            await self.svc.create_programacao_semanal(
                fake_db, self.base(), admin_user
            )
        assert exc.value.status_code == HTTPStatus.CONFLICT

    async def test_create_ok(self, fake_db, admin_user):
        fake_db.queue_fetchrow(None, {'id': 4})
        resultado = await self.svc.create_programacao_semanal(
            fake_db, self.base(), admin_user
        )
        assert resultado == {'id': 4}

    async def test_update_conflito_409(self, fake_db, admin_user):
        atual = {
            'id': 1,
            'profissional_id': 1,
            'dia_semana': 'Segunda',
        }
        fake_db.queue_fetchrow(atual, {'id': 2})
        with pytest.raises(HTTPException) as exc:
            await self.svc.update_programacao_semanal(
                fake_db,
                1,
                ProgramacaoSemanalUpdate(dia_semana='Terca'),
                admin_user,
            )
        assert exc.value.status_code == HTTPStatus.CONFLICT


class TestStatusPagamentosServices:
    def setup_method(self):
        self.svc = StatusPagamentosServices()

    async def test_create_nome_duplicado_409(self, fake_db, admin_user):
        fake_db.queue_fetchrow({'id': 1})
        with pytest.raises(HTTPException) as exc:
            await self.svc.create_status_pagamento(
                fake_db, StatusPagamentoBase(nome='Pago'), admin_user
            )
        assert exc.value.status_code == HTTPStatus.CONFLICT

    async def test_get_404(self, fake_db, admin_user):
        fake_db.fetch_default = []
        with pytest.raises(HTTPException) as exc:
            await self.svc.get_status_pagamentos(
                fake_db, StatusPagamentoFilter(), admin_user
            )
        assert exc.value.status_code == HTTPStatus.NOT_FOUND

    async def test_delete_ok(self, fake_db, admin_user):
        fake_db.queue_fetchrow({'id': 1}, {'id': 1})
        resultado = await self.svc.delete_status_pagamento(
            fake_db, 1, admin_user
        )
        assert 'deletado' in resultado['message']


class TestTokenServices:
    def setup_method(self):
        self.svc = TokenServices()

    async def test_login_usuario_inexistente_401(self, fake_db):
        from fastapi.security import OAuth2PasswordRequestForm

        fake_db.queue_fetchrow(None)
        form = OAuth2PasswordRequestForm(
            username='x@mail.com', password='y'
        )
        with pytest.raises(HTTPException) as exc:
            await self.svc.login_for_access_token(fake_db, form)
        assert exc.value.status_code == HTTPStatus.UNAUTHORIZED
        assert exc.value.detail == 'Usuário não cadastrado'

    async def test_login_senha_errada_401(self, fake_db):
        from fastapi.security import OAuth2PasswordRequestForm

        from api.security import get_password_hash

        fake_db.queue_fetchrow(None)
        fake_db.queue_fetchrow(
            {
                'id': 1,
                'email': 'a@mail.com',
                'password': get_password_hash('certa'),
                'type_user_id': 2,
            }
        )
        form = OAuth2PasswordRequestForm(
            username='a@mail.com', password='errada'
        )
        with pytest.raises(HTTPException) as exc:
            await self.svc.login_for_access_token(fake_db, form)
        assert exc.value.status_code == HTTPStatus.UNAUTHORIZED
        assert exc.value.detail == 'Usuário ou senha inválidos'

    async def test_login_ok_retorna_tokens(self, fake_db):
        from fastapi.security import OAuth2PasswordRequestForm

        from api.security import get_password_hash

        fake_db.queue_fetchrow(None)
        fake_db.queue_fetchrow(
            {
                'id': 1,
                'email': 'a@mail.com',
                'password': get_password_hash('certa'),
                'type_user_id': 2,
            }
        )
        form = OAuth2PasswordRequestForm(
            username='a@mail.com', password='certa'
        )
        resultado = await self.svc.login_for_access_token(
            fake_db, form
        )
        assert resultado['access_token']
        assert resultado['refresh_token']
        assert resultado['user'].email == 'a@mail.com'
        assert resultado['user'].type_user_id == 2

    async def test_login_admin_tabela_administradores(self, fake_db):
        from fastapi.security import OAuth2PasswordRequestForm

        from api.security import get_password_hash

        fake_db.queue_fetchrow(
            {
                'id': 9,
                'nome': 'Ana Clara',
                'email': 'admin@nails.com',
                'password': get_password_hash('segredo123'),
                'type_user_id': 2,
            }
        )
        form = OAuth2PasswordRequestForm(
            username='admin@nails.com', password='segredo123'
        )
        resultado = await self.svc.login_for_access_token(
            fake_db, form
        )
        assert resultado['user'].type_user_id == 1
        assert resultado['user'].email == 'admin@nails.com'

    async def test_login_admin_senha_errada_401(self, fake_db):
        from fastapi.security import OAuth2PasswordRequestForm

        from api.security import get_password_hash

        fake_db.queue_fetchrow(
            {
                'id': 9,
                'email': 'admin@nails.com',
                'password': get_password_hash('segredo123'),
                'type_user_id': 1,
            }
        )
        form = OAuth2PasswordRequestForm(
            username='admin@nails.com', password='errada'
        )
        with pytest.raises(HTTPException) as exc:
            await self.svc.login_for_access_token(fake_db, form)
        assert exc.value.status_code == HTTPStatus.UNAUTHORIZED
        assert exc.value.detail == 'Usuário ou senha inválidos'


class TestCoberturaComplementar:
    async def test_admin_update_ok_delete_404_create_500(
        self, fake_db, admin_user
    ):
        svc = AdministradoresServices()
        fake_db.queue_fetchrow({'id': 1}, {'id': 1, 'nome': 'B'})
        resultado = await svc.update_administrador(
            fake_db, 1, AdministradorUpdate(nome='B'), admin_user
        )
        assert resultado == {'id': 1, 'nome': 'B'}

        fake_db.queue_fetchrow(None)
        with pytest.raises(HTTPException) as exc:
            await svc.delete_administrador(fake_db, 9, admin_user)
        assert exc.value.status_code == HTTPStatus.NOT_FOUND

        fake_db.queue_fetchrow(None, None, None)
        with pytest.raises(HTTPException) as exc:
            await svc.create_administrador(
                fake_db,
                admin_user,
                AdministradorBase(
                    nome='A',
                    email='a@mail.com',
                    password='x',
                    type_user_id=1,
                ),
            )
        assert exc.value.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

    async def test_agendamento_get_create_500_delete(
        self, fake_db, admin_user
    ):
        svc = AgendamentosServices()
        fake_db.queue_fetch([{'id': 1}])
        assert await svc.get_agendamentos(
            fake_db, AgendamentoFilter(), admin_user
        ) == [{'id': 1}]

        fake_db.fetch_default = []
        with pytest.raises(HTTPException) as exc:
            await svc.get_agendamentos(
                fake_db, AgendamentoFilter(), admin_user
            )
        assert exc.value.status_code == HTTPStatus.NOT_FOUND

        fake_db.queue_fetchrow(MODELO, None, {'id': 5}, None)
        with pytest.raises(HTTPException) as exc:
            await svc.create_agendamento(
                fake_db, AgenamentoBase(**AG_BASE)
            )
        assert exc.value.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

        fake_db.queue_fetchrow(None)
        with pytest.raises(HTTPException) as exc:
            await svc.delete_agendamento(fake_db, 9, admin_user)
        assert exc.value.status_code == HTTPStatus.NOT_FOUND

        fake_db.queue_fetchrow(AG_ATUAL, None)
        with pytest.raises(HTTPException) as exc:
            await svc.delete_agendamento(fake_db, 1, admin_user)
        assert exc.value.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

    async def test_cliente_create_update_delete(self, fake_db, admin_user):
        svc = ClientesServices()
        fake_db.queue_fetchrow(None, None, {'id': 1})
        assert await svc.create_cliente(
            fake_db, ClienteBase(nome='A', telefone='1')
        ) == {'id': 1}

        fake_db.queue_fetchrow(None, None, None)
        with pytest.raises(HTTPException) as exc:
            await svc.create_cliente(
                fake_db, ClienteBase(nome='A', telefone='1')
            )
        assert exc.value.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

        fake_db.queue_fetch([{'id': 1}])
        assert await svc.get_clientes(
            fake_db, ClienteFilter(), admin_user
        ) == [{'id': 1}]

        fake_db.queue_fetchrow({'id': 1}, {'id': 1})
        assert await svc.update_clientes(
            fake_db, 1, ClienteUpdate(nome='B'), admin_user
        ) == {'id': 1}

        fake_db.queue_fetchrow(None)
        with pytest.raises(HTTPException) as exc:
            await svc.delete_cliente(fake_db, 9, admin_user)
        assert exc.value.status_code == HTTPStatus.NOT_FOUND

    async def test_modelo_fluxo_completo(self, fake_db, admin_user):
        svc = ModelosUnhasServices()
        base = ModeloUnhaBase(
            nome='C',
            valor_total=10.0,
            categoria='X',
            descricao='Y',
            duracao=time(1, 0),
        )
        fake_db.queue_fetchrow(None, None)
        with pytest.raises(HTTPException) as exc:
            await svc.create_modelo_unha(fake_db, base, admin_user)
        assert exc.value.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

        fake_db.fetch_default = []
        with pytest.raises(HTTPException) as exc:
            await svc.get_modelos_unhas(fake_db, ModeloUnhaFilter())
        assert exc.value.status_code == HTTPStatus.NOT_FOUND

        for seq, esperado in [
            ([None], HTTPStatus.NOT_FOUND),
            ([{'id': 1}], HTTPStatus.BAD_REQUEST),
        ]:
            fake_db.queue_fetchrow(*seq)
            with pytest.raises(HTTPException) as exc:
                await svc.update_modelo_unha(
                    fake_db,
                    1,
                    ModeloUnhaUpdate()
                    if esperado == HTTPStatus.BAD_REQUEST
                    else ModeloUnhaUpdate(nome='Z'),
                    admin_user,
                )
            assert exc.value.status_code == esperado

        fake_db.queue_fetchrow({'id': 1}, None, {'id': 1})
        assert await svc.update_modelo_unha(
            fake_db, 1, ModeloUnhaUpdate(nome='Z'), admin_user
        ) == {'id': 1}

        fake_db.queue_fetchrow({'id': 1}, None)
        with pytest.raises(HTTPException) as exc:
            await svc.update_modelo_unha(
                fake_db, 1, ModeloUnhaUpdate(nome='Z'), admin_user
            )
        assert exc.value.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

        fake_db.queue_fetchrow(None)
        with pytest.raises(HTTPException) as exc:
            await svc.delete_modelo_unha(fake_db, 9, admin_user)
        assert exc.value.status_code == HTTPStatus.NOT_FOUND

        fake_db.queue_fetchrow({'id': 1}, None)
        with pytest.raises(HTTPException) as exc:
            await svc.delete_modelo_unha(fake_db, 1, admin_user)
        assert exc.value.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

    async def test_nail_design_fluxo_completo(self, fake_db, admin_user):
        svc = NailDesignsServices()
        base = NailDesignBase(nome='A', cpf='1', telefone='2')

        fake_db.queue_fetchrow(None, {'id': 1})
        assert await svc.create_nail_design(
            fake_db, base, admin_user
        ) == {'id': 1}

        fake_db.queue_fetchrow(None, None)
        with pytest.raises(HTTPException) as exc:
            await svc.create_nail_design(fake_db, base, admin_user)
        assert exc.value.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

        fake_db.queue_fetch([{'id': 1}])
        assert await svc.get_nail_designs(
            fake_db, NailDesignFilter(), admin_user
        ) == [{'id': 1}]

        fake_db.fetch_default = []
        with pytest.raises(HTTPException) as exc:
            await svc.get_nail_designs(
                fake_db, NailDesignFilter(), admin_user
            )
        assert exc.value.status_code == HTTPStatus.NOT_FOUND

        fake_db.queue_fetchrow({'id': 1}, {'id': 1})
        assert await svc.update_nail_design(
            fake_db, 1, NailDesignUpdate(nome='B'), admin_user
        ) == {'id': 1}

        fake_db.queue_fetchrow({'id': 1})
        with pytest.raises(HTTPException) as exc:
            await svc.update_nail_design(
                fake_db, 1, NailDesignUpdate(), admin_user
            )
        assert exc.value.status_code == HTTPStatus.BAD_REQUEST

        fake_db.queue_fetchrow({'id': 1}, None)
        with pytest.raises(HTTPException) as exc:
            await svc.update_nail_design(
                fake_db, 1, NailDesignUpdate(nome='B'), admin_user
            )
        assert exc.value.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

        fake_db.queue_fetchrow(None)
        with pytest.raises(HTTPException) as exc:
            await svc.delete_nail_design(fake_db, 9, admin_user)
        assert exc.value.status_code == HTTPStatus.NOT_FOUND

        fake_db.queue_fetchrow({'id': 1}, None)
        with pytest.raises(HTTPException) as exc:
            await svc.delete_nail_design(fake_db, 1, admin_user)
        assert exc.value.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

        fake_db.queue_fetchrow({'id': 1}, {'id': 1})
        assert 'deletada' in (
            await svc.delete_nail_design(fake_db, 1, admin_user)
        )['message']

    async def test_programacao_fluxo_completo(self, fake_db, admin_user):
        svc = ProgramacaoSemanalServices()
        base = ProgramacaoSemanalBase(
            profissional_id=1,
            dia_semana='Segunda',
            ativo=True,
            inicio_expediente='09:00',
            fim_expediente='18:00',
            pausa_duracao=time(1, 0),
        )
        fake_db.queue_fetchrow(None, None)
        with pytest.raises(HTTPException) as exc:
            await svc.create_programacao_semanal(
                fake_db, base, admin_user
            )
        assert exc.value.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

        fake_db.queue_fetch([{'id': 1}])
        assert await svc.get_programacao_semanal(
            fake_db, ProgramacaoSemanalFilter()
        ) == [{'id': 1}]

        fake_db.fetch_default = []
        with pytest.raises(HTTPException) as exc:
            await svc.get_programacao_semanal(
                fake_db, ProgramacaoSemanalFilter()
            )
        assert exc.value.status_code == HTTPStatus.NOT_FOUND

        fake_db.queue_fetchrow(None)
        with pytest.raises(HTTPException) as exc:
            await svc.update_programacao_semanal(
                fake_db, 1, ProgramacaoSemanalUpdate(ativo=False),
                admin_user,
            )
        assert exc.value.status_code == HTTPStatus.NOT_FOUND

        fake_db.queue_fetchrow({'id': 1})
        with pytest.raises(HTTPException) as exc:
            await svc.update_programacao_semanal(
                fake_db, 1, ProgramacaoSemanalUpdate(), admin_user
            )
        assert exc.value.status_code == HTTPStatus.BAD_REQUEST

        atual = {'id': 1, 'profissional_id': 1, 'dia_semana': 'Segunda'}
        fake_db.queue_fetchrow(atual, {'id': 1})
        assert await svc.update_programacao_semanal(
            fake_db, 1, ProgramacaoSemanalUpdate(ativo=False), admin_user
        ) == {'id': 1}

        fake_db.queue_fetchrow(atual, None)
        with pytest.raises(HTTPException) as exc:
            await svc.update_programacao_semanal(
                fake_db, 1, ProgramacaoSemanalUpdate(ativo=False),
                admin_user,
            )
        assert exc.value.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

        fake_db.queue_fetchrow(None)
        with pytest.raises(HTTPException) as exc:
            await svc.delete_programacao_semanal(
                fake_db, 9, admin_user
            )
        assert exc.value.status_code == HTTPStatus.NOT_FOUND

        fake_db.queue_fetchrow({'id': 1}, None)
        with pytest.raises(HTTPException) as exc:
            await svc.delete_programacao_semanal(fake_db, 1, admin_user)
        assert exc.value.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

        fake_db.queue_fetchrow({'id': 1}, {'id': 1})
        assert 'deletada' in (
            await svc.delete_programacao_semanal(
                fake_db, 1, admin_user
            )
        )['message']

    async def test_status_fluxo_completo(self, fake_db, admin_user):
        svc = StatusPagamentosServices()
        fake_db.queue_fetchrow(None, {'id': 1, 'nome': 'Pago'})
        assert await svc.create_status_pagamento(
            fake_db, StatusPagamentoBase(nome='Pago'), admin_user
        ) == {'id': 1, 'nome': 'Pago'}

        fake_db.queue_fetchrow(None, None)
        with pytest.raises(HTTPException) as exc:
            await svc.create_status_pagamento(
                fake_db, StatusPagamentoBase(nome='Pago'), admin_user
            )
        assert exc.value.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

        fake_db.queue_fetch([{'id': 1}])
        assert await svc.get_status_pagamentos(
            fake_db, StatusPagamentoFilter(), admin_user
        ) == [{'id': 1}]

        fake_db.queue_fetchrow(None)
        with pytest.raises(HTTPException) as exc:
            await svc.update_status_pagamento(
                fake_db, 1, StatusPagamentoUpdate(nome='X'), admin_user
            )
        assert exc.value.status_code == HTTPStatus.NOT_FOUND

        fake_db.queue_fetchrow({'id': 1})
        with pytest.raises(HTTPException) as exc:
            await svc.update_status_pagamento(
                fake_db, 1, StatusPagamentoUpdate(), admin_user
            )
        assert exc.value.status_code == HTTPStatus.BAD_REQUEST

        fake_db.queue_fetchrow({'id': 1}, {'id': 2})
        with pytest.raises(HTTPException) as exc:
            await svc.update_status_pagamento(
                fake_db, 1, StatusPagamentoUpdate(nome='X'), admin_user
            )
        assert exc.value.status_code == HTTPStatus.CONFLICT

        fake_db.queue_fetchrow({'id': 1}, None, {'id': 1})
        assert await svc.update_status_pagamento(
            fake_db, 1, StatusPagamentoUpdate(nome='X'), admin_user
        ) == {'id': 1}

        fake_db.queue_fetchrow({'id': 1}, None, None)
        with pytest.raises(HTTPException) as exc:
            await svc.update_status_pagamento(
                fake_db, 1, StatusPagamentoUpdate(nome='X'), admin_user
            )
        assert exc.value.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

        fake_db.queue_fetchrow(None)
        with pytest.raises(HTTPException) as exc:
            await svc.delete_status_pagamento(fake_db, 9, admin_user)
        assert exc.value.status_code == HTTPStatus.NOT_FOUND

        fake_db.queue_fetchrow({'id': 1}, None)
        with pytest.raises(HTTPException) as exc:
            await svc.delete_status_pagamento(fake_db, 1, admin_user)
        assert exc.value.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

    async def test_usuario_500s(self, fake_db, admin_user):
        svc = UsuarioServices()
        fake_db.queue_fetchrow({'id': 1}, None, None)
        with pytest.raises(HTTPException) as exc:
            await svc.update_usuarios(
                fake_db, 1, UsuarioUpdate(email='n@mail.com'), admin_user
            )
        assert exc.value.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

        fake_db.queue_fetchrow({'id': 1}, None)
        with pytest.raises(HTTPException) as exc:
            await svc.delete_usuario(fake_db, 1, admin_user)
        assert exc.value.status_code == HTTPStatus.INTERNAL_SERVER_ERROR


class TestPasswordResetServices:
    def setup_method(self):
        self.svc = TokenServices()

    async def test_recuperar_sempre_202_mesmo_desconhecido(self, fake_db):
        from api.schemas.password_reset_schemas import RecuperarSenha

        fake_db.queue_fetchrow(None)
        resultado = await self.svc.solicitar_recuperacao(
            fake_db, RecuperarSenha(email='ninguem@mail.com')
        )
        assert 'message' in resultado

    async def test_recuperar_cria_token_para_existente(self, fake_db):
        from api.schemas.password_reset_schemas import RecuperarSenha

        fake_db.queue_fetchrow({'id': 7, 'email': 'a@mail.com'})
        fake_db.queue_fetchrow({'id': 11})
        resultado = await self.svc.solicitar_recuperacao(
            fake_db, RecuperarSenha(email='a@mail.com')
        )
        assert 'message' in resultado

    async def test_redefinir_ok(self, fake_db):
        from hashlib import sha256

        from api.schemas.password_reset_schemas import RedefinirSenha

        digest = sha256(b'token-valido-1234567890').hexdigest()
        fake_db.queue_fetch(
            [
                {
                    'id': 5,
                    'usuario_id': 7,
                    'token_hash': digest,
                    'expira_em': '2999-01-01T00:00:00+00:00',
                    'usado_em': None,
                }
            ]
        )
        fake_db.queue_fetchrow({'id': 7})
        fake_db.queue_fetchrow({'id': 5})
        resultado = await self.svc.redefinir_senha(
            fake_db,
            RedefinirSenha(
                token='token-valido-1234567890', nova_senha='NovaSenha123'
            ),
        )
        assert 'message' in resultado

    async def test_redefinir_token_invalido_400(self, fake_db):
        from api.schemas.password_reset_schemas import RedefinirSenha

        fake_db.queue_fetch([])
        with pytest.raises(HTTPException) as exc:
            await self.svc.redefinir_senha(
                fake_db,
                RedefinirSenha(
                    token='token-inexistente-1234567890', nova_senha='NovaSenha123'
                ),
            )
        assert exc.value.status_code == HTTPStatus.BAD_REQUEST

    async def test_redefinir_expirado_400(self, fake_db):
        from hashlib import sha256

        from api.schemas.password_reset_schemas import RedefinirSenha

        digest = sha256(b'token-velho-12345678901234').hexdigest()
        fake_db.queue_fetch(
            [
                {
                    'id': 6,
                    'usuario_id': 7,
                    'token_hash': digest,
                    'expira_em': '2000-01-01T00:00:00+00:00',
                    'usado_em': None,
                }
            ]
        )
        with pytest.raises(HTTPException) as exc:
            await self.svc.redefinir_senha(
                fake_db,
                RedefinirSenha(
                    token='token-velho-12345678901234', nova_senha='NovaSenha123'
                ),
            )
        assert exc.value.status_code == HTTPStatus.BAD_REQUEST

    async def test_redefinir_ja_usado_400(self, fake_db):
        from hashlib import sha256

        from api.schemas.password_reset_schemas import RedefinirSenha

        digest = sha256(b'token-usado-12345678901234').hexdigest()
        fake_db.queue_fetch(
            [
                {
                    'id': 7,
                    'usuario_id': 7,
                    'token_hash': digest,
                    'expira_em': '2999-01-01T00:00:00+00:00',
                    'usado_em': '2026-01-01T00:00:00+00:00',
                }
            ]
        )
        with pytest.raises(HTTPException) as exc:
            await self.svc.redefinir_senha(
                fake_db,
                RedefinirSenha(
                    token='token-usado-12345678901234', nova_senha='NovaSenha123'
                ),
            )
        assert exc.value.status_code == HTTPStatus.BAD_REQUEST


class TestNovosCampos:
    async def test_modelo_ativo_destaque(self, fake_db, admin_user):
        svc = ModelosUnhasServices()
        fake_db.queue_fetchrow({'id': 1}, {'id': 1})
        resultado = await svc.update_modelo_unha(
            fake_db,
            1,
            ModeloUnhaUpdate(ativo=False, destaque=True),
            admin_user,
        )
        assert resultado == {'id': 1}

    async def test_cliente_cpf_prefs(self, fake_db, admin_user):
        svc = ClientesServices()
        fake_db.queue_fetchrow({'id': 1}, {'id': 1})
        resultado = await svc.update_clientes(
            fake_db,
            1,
            ClienteUpdate(
                cpf='12345678909',
                data_nascimento='1998-03-14',
                pref_app=True,
                pref_email=True,
                pref_whatsapp=False,
            ),
            admin_user,
        )
        assert resultado == {'id': 1}

from datetime import time

from api.security import create_refresh_token, get_password_hash
from tests.conftest import CSRF_COOKIES, CSRF_HEADERS


def csrf(**kwargs):
    kwargs.setdefault('headers', CSRF_HEADERS)
    kwargs.setdefault('cookies', CSRF_COOKIES)
    return kwargs


class TestLogin:
    async def test_login_usuario_inexistente_401(self, client, fake_db):
        fake_db.queue_fetchrow(None)
        resposta = await client.post(
            '/api/v1/login/',
            data={'username': 'x@mail.com', 'password': 'y'},
            **csrf(),
        )
        assert resposta.status_code == 401

    async def test_login_senha_errada_401(self, client, fake_db):
        fake_db.queue_fetchrow(None)
        fake_db.queue_fetchrow(
            {
                'id': 1,
                'email': 'a@mail.com',
                'password': get_password_hash('certa'),
                'type_user_id': 2,
            }
        )
        resposta = await client.post(
            '/api/v1/login/',
            data={'username': 'a@mail.com', 'password': 'errada'},
            **csrf(),
        )
        assert resposta.status_code == 401

    async def test_login_ok_200_com_tokens_no_corpo(self, client, fake_db):
        fake_db.queue_fetchrow(None)
        fake_db.queue_fetchrow(
            {
                'id': 1,
                'email': 'a@mail.com',
                'password': get_password_hash('certa'),
                'type_user_id': 2,
            }
        )
        resposta = await client.post(
            '/api/v1/login/',
            data={'username': 'a@mail.com', 'password': 'certa'},
            **csrf(),
        )
        assert resposta.status_code == 200
        assert resposta.json()['user']['email'] == 'a@mail.com'
        assert 'password' not in resposta.json()['user']
        ## SESSÃO POR ABA: tokens no corpo, sem cookies de sessão
        assert resposta.json()['access_token']
        assert resposta.json()['refresh_token']
        assert 'access_token' not in resposta.cookies
        assert 'refresh_token' not in resposta.cookies

    async def test_login_sem_csrf_401(self, client, fake_db):
        ## /login/ É ISENTO DE CSRF POR DESIGN (EXEMPT_PATHS)
        fake_db.queue_fetchrow(None)
        resposta = await client.post(
            '/api/v1/login/',
            data={'username': 'a@mail.com', 'password': 'x'},
        )
        assert resposta.status_code == 401

    async def test_post_sem_csrf_403(self, client, fake_db, as_anon):
        ## /usuarios/ É ISENTO (CADASTRO PÚBLICO); USA ROTA PROTEGIDA
        resposta = await client.post(
            '/api/v1/clientes',
            json={'nome': 'Ana', 'telefone': '11999999999'},
        )
        assert resposta.status_code == 403

    async def test_cadastro_publico_sem_csrf_201(self, client, fake_db):
        fake_db.queue_fetchrow(
            None,
            {
                'id': 1,
                'email': 'a@mail.com',
                'password': 'h',
                'type_user_id': '2',
            },
        )
        resposta = await client.post(
            '/api/v1/usuarios',
            json={'email': 'a@mail.com', 'password': 'x'},
        )
        assert resposta.status_code == 201

    async def test_me_anonimo_401(self, client, as_anon):
        resposta = await client.get('/api/v1/login/auth/me')
        assert resposta.status_code == 401

    async def test_me_logado_200(self, client, as_admin):
        resposta = await client.get('/api/v1/login/auth/me')
        assert resposta.status_code == 200
        assert 'user' in resposta.json()

    async def test_refresh_sem_cookie_401(self, client):
        resposta = await client.post(
            '/api/v1/login/auth/refresh', **csrf()
        )
        assert resposta.status_code == 401

    async def test_refresh_ok_200(self, client, fake_db):
        token = await create_refresh_token(
            {'sub': 'a@mail.com', 'type_user_id': 2}
        )
        fake_db.queue_fetchrow(
            {
                'id': 1,
                'nome': 'Ana',
                'email': 'a@mail.com',
                'password': 'h',
                'type_user_id': 2,
            }
        )
        resposta = await client.post(
            '/api/v1/login/auth/refresh',
            json={'refresh_token': token},
            headers=CSRF_HEADERS,
            cookies={**CSRF_COOKIES},
        )
        assert resposta.status_code == 200
        assert resposta.json()['access_token']
        assert resposta.json()['refresh_token']

    async def test_logout_200(self, client, as_anon):
        resposta = await client.post(
            '/api/v1/login/logout/', **csrf()
        )
        assert resposta.status_code == 200
        assert 'message' in resposta.json()


class TestUsuarios:
    async def test_post_201(self, client, fake_db, as_anon):
        fake_db.queue_fetchrow(
            None,
            {
                'id': 1,
                'email': 'a@mail.com',
                'password': 'h',
                'type_user_id': '2',
            },
        )
        resposta = await client.post(
            '/api/v1/usuarios',
            json={'email': 'a@mail.com', 'password': 'x'},
            **csrf(),
        )
        assert resposta.status_code == 201
        assert resposta.json()['id'] == 1
        assert 'password' not in resposta.json()

    async def test_post_publico_nao_cria_admin(self, client, fake_db, as_anon):
        fake_db.queue_fetchrow(
            None,
            {
                'id': 2,
                'email': 'e@mail.com',
                'password': 'h',
                'type_user_id': 2,
            },
        )
        resposta = await client.post(
            '/api/v1/usuarios',
            json={'email': 'e@mail.com', 'password': 'x', 'type_user_id': 1},
            **csrf(),
        )
        assert resposta.status_code == 201
        assert resposta.json()['type_user_id'] == 2

    async def test_post_duplicado_409(self, client, fake_db, as_anon):
        fake_db.queue_fetchrow({'id': 1})
        resposta = await client.post(
            '/api/v1/usuarios',
            json={'email': 'a@mail.com', 'password': 'x'},
            **csrf(),
        )
        assert resposta.status_code == 409

    async def test_post_body_invalido_422(self, client, as_anon):
        resposta = await client.post(
            '/api/v1/usuarios', json={'email': 'a@mail.com'}, **csrf()
        )
        assert resposta.status_code == 422

    async def test_get_200_publico(self, client, fake_db):
        fake_db.queue_fetch(
            [
                {
                    'id': 1,
                    'email': 'a@mail.com',
                    'password': 'h',
                    'type_user_id': '2',
                }
            ]
        )
        resposta = await client.get('/api/v1/usuarios')
        assert resposta.status_code == 200
        assert len(resposta.json()['usuarios']) == 1

    async def test_get_vazio_404(self, client, fake_db):
        resposta = await client.get('/api/v1/usuarios')
        assert resposta.status_code == 404

    async def test_patch_401_anonimo(self, client, as_anon, fake_db):
        resposta = await client.patch(
            '/api/v1/usuarios/1',
            json={'email': 'n@mail.com'},
            **csrf(),
        )
        assert resposta.status_code == 401

    async def test_patch_200(self, client, fake_db, as_admin):
        fake_db.queue_fetchrow(
            {'id': 1}, None, {'id': 1, 'email': 'n@mail.com', 'password': 'h'}
        )
        resposta = await client.patch(
            '/api/v1/usuarios/1',
            json={'email': 'n@mail.com'},
            **csrf(),
        )
        assert resposta.status_code == 200

    async def test_delete_200(self, client, fake_db, as_admin):
        fake_db.queue_fetchrow({'id': 1}, {'id': 1})
        resposta = await client.delete(
            '/api/v1/usuarios/1', **csrf()
        )
        assert resposta.status_code == 200
        assert 'message' in resposta.json()


class TestAdministradores:
    async def test_post_403_comum(self, client, fake_db, as_user):
        resposta = await client.post(
            '/api/v1/administradores',
            json={
                'nome': 'Ana',
                'email': 'a@mail.com',
                'password': 'x',
                'type_user_id': 1,
            },
            **csrf(),
        )
        assert resposta.status_code == 403

    async def test_post_201_admin(self, client, fake_db, as_admin):
        fake_db.queue_fetchrow(
            None,
            None,
            {
                'id': 1,
                'nome': 'Ana',
                'email': 'a@mail.com',
                'password': 'h',
                'type_user_id': 1,
                'nail_design_id': None,
            },
        )
        resposta = await client.post(
            '/api/v1/administradores',
            json={
                'nome': 'Ana',
                'email': 'a@mail.com',
                'password': 'x',
                'type_user_id': 1,
            },
            **csrf(),
        )
        assert resposta.status_code == 201

    async def test_get_200(self, client, fake_db, as_admin):
        fake_db.queue_fetch(
            [
                {
                    'id': 1,
                    'nome': 'Ana',
                    'email': 'a@mail.com',
                    'password': 'h',
                    'type_user_id': 1,
                    'nail_design_id': None,
                }
            ]
        )
        resposta = await client.get('/api/v1/administradores')
        assert resposta.status_code == 200
        assert 'administradores' in resposta.json()

    async def test_delete_200(self, client, fake_db, as_admin):
        fake_db.queue_fetchrow({'id': 1}, {'id': 1})
        resposta = await client.delete(
            '/api/v1/administradores/1', **csrf()
        )
        assert resposta.status_code == 200


class TestClientes:
    async def test_post_201_publico(self, client, fake_db, as_anon):
        fake_db.queue_fetchrow(
            None, None, {'id': 1, 'nome': 'Ana', 'telefone': '111'}
        )
        resposta = await client.post(
            '/api/v1/clientes',
            json={'nome': 'Ana', 'telefone': '111'},
            **csrf(),
        )
        assert resposta.status_code == 201

    async def test_get_401_anonimo(self, client, as_anon, fake_db):
        resposta = await client.get('/api/v1/clientes')
        assert resposta.status_code == 401

    async def test_get_200_logado(self, client, fake_db, as_user):
        fake_db.queue_fetch(
            [{'id': 1, 'nome': 'Ana', 'telefone': '111'}]
        )
        resposta = await client.get('/api/v1/clientes')
        assert resposta.status_code == 200
        assert 'clientes' in resposta.json()

    async def test_patch_200(self, client, fake_db, as_user):
        fake_db.queue_fetchrow(
            {'id': 1}, {'id': 1, 'nome': 'Bia', 'telefone': '111'}
        )
        resposta = await client.patch(
            '/api/v1/clientes/1', json={'nome': 'Bia'}, **csrf()
        )
        assert resposta.status_code == 200

    async def test_delete_403_comum(self, client, fake_db, as_user):
        resposta = await client.delete(
            '/api/v1/clientes/1', **csrf()
        )
        assert resposta.status_code == 403

    async def test_delete_200_admin(self, client, fake_db, as_admin):
        fake_db.queue_fetchrow({'id': 1}, {'id': 1})
        resposta = await client.delete(
            '/api/v1/clientes/1', **csrf()
        )
        assert resposta.status_code == 200


AGENDAMENTO_ROW = {
    'id': 1,
    'cliente_id': 1,
    'modelo_id': 2,
    'horario': time(9, 0),
    'sinal': 50.0,
    'status_pagamentos_id': 5,
}


class TestAgendamentos:
    async def test_post_201(self, client, fake_db, as_user):
        fake_db.queue_fetchrow(
            {'id': 2, 'valor_total': 100.0},
            None,
            {'id': 5},
            AGENDAMENTO_ROW,
            {'id': 300},
        )
        resposta = await client.post(
            '/api/v1/agendamentos',
            json={
                'cliente_id': 1,
                'modelo_id': 2,
                'horario': '09:00:00',
                'sinal': 50.0,
            },
            **csrf(),
        )
        assert resposta.status_code == 201
        assert resposta.json()['id'] == 1

    async def test_post_sinal_invalido_422(self, client, fake_db, as_user):
        fake_db.queue_fetchrow({'id': 2, 'valor_total': 100.0})
        resposta = await client.post(
            '/api/v1/agendamentos',
            json={
                'cliente_id': 1,
                'modelo_id': 2,
                'horario': '09:00:00',
                'sinal': 10.0,
            },
            **csrf(),
        )
        assert resposta.status_code == 422

    async def test_post_horario_ocupado_409(self, client, fake_db, as_user):
        fake_db.queue_fetchrow(
            {'id': 2, 'valor_total': 100.0}, {'id': 9}
        )
        resposta = await client.post(
            '/api/v1/agendamentos',
            json={
                'cliente_id': 1,
                'modelo_id': 2,
                'horario': '09:00:00',
                'sinal': 50.0,
            },
            **csrf(),
        )
        assert resposta.status_code == 409

    async def test_get_401_anonimo(self, client, as_anon, fake_db):
        resposta = await client.get('/api/v1/agendamentos')
        assert resposta.status_code == 401

    async def test_patch_403_comum(self, client, fake_db, as_user):
        resposta = await client.patch(
            '/api/v1/agendamentos/1',
            json={'horario': '10:00:00'},
            **csrf(),
        )
        assert resposta.status_code == 403

    async def test_delete_200_admin(self, client, fake_db, as_admin):
        fake_db.queue_fetchrow(
            AGENDAMENTO_ROW, AGENDAMENTO_ROW, {'id': 301}
        )
        resposta = await client.delete(
            '/api/v1/agendamentos/1', **csrf()
        )
        assert resposta.status_code == 200


MODELO_ROW = {
    'id': 1,
    'nome': 'Chrome',
    'valor_total': 140.0,
    'categoria': 'Festa',
    'descricao': 'Brilho',
    'duracao': time(1, 30),
}


class TestModelosUnhas:
    async def test_get_200_publico(self, client, fake_db):
        fake_db.queue_fetch([MODELO_ROW])
        resposta = await client.get('/api/v1/modelos-unhas')
        assert resposta.status_code == 200
        assert resposta.json()['modelos_unhas'][0]['nome'] == 'Chrome'

    async def test_post_403_comum(self, client, fake_db, as_user):
        resposta = await client.post(
            '/api/v1/modelos-unhas',
            json={
                'nome': 'Chrome',
                'valor_total': 140.0,
                'categoria': 'Festa',
                'descricao': 'Brilho',
                'duracao': '01:30:00',
            },
            **csrf(),
        )
        assert resposta.status_code == 403

    async def test_post_201_admin(self, client, fake_db, as_admin):
        fake_db.queue_fetchrow(None, MODELO_ROW)
        resposta = await client.post(
            '/api/v1/modelos-unhas',
            json={
                'nome': 'Chrome',
                'valor_total': 140.0,
                'categoria': 'Festa',
                'descricao': 'Brilho',
                'duracao': '01:30:00',
            },
            **csrf(),
        )
        assert resposta.status_code == 201

    async def test_delete_200_admin(self, client, fake_db, as_admin):
        fake_db.queue_fetchrow(MODELO_ROW, MODELO_ROW)
        resposta = await client.delete(
            '/api/v1/modelos-unhas/1', **csrf()
        )
        assert resposta.status_code == 200


class TestNailDesigns:
    async def test_get_401_anonimo(self, client, as_anon, fake_db):
        resposta = await client.get('/api/v1/nail-designs')
        assert resposta.status_code == 401

    async def test_post_201_admin(self, client, fake_db, as_admin):
        row = {'id': 1, 'nome': 'Ana', 'cpf': '123', 'telefone': '111'}
        fake_db.queue_fetchrow(None, row)
        resposta = await client.post(
            '/api/v1/nail-designs',
            json={'nome': 'Ana', 'cpf': '123', 'telefone': '111'},
            **csrf(),
        )
        assert resposta.status_code == 201


class TestProgramacaoSemanal:
    async def test_get_200_publico(self, client, fake_db):
        fake_db.queue_fetch(
            [
                {
                    'id': 1,
                    'profissional_id': 1,
                    'dia_semana': 'Segunda',
                    'ativo': True,
                    'inicio_expediente': '09:00',
                    'fim_expediente': '18:00',
                    'pausa_duracao': time(1, 0),
                }
            ]
        )
        resposta = await client.get('/api/v1/programacao-semanal')
        assert resposta.status_code == 200

    async def test_post_conflito_409(self, client, fake_db, as_admin):
        fake_db.queue_fetchrow({'id': 1})
        resposta = await client.post(
            '/api/v1/programacao-semanal',
            json={
                'profissional_id': 1,
                'dia_semana': 'Segunda',
                'ativo': True,
                'inicio_expediente': '09:00',
                'fim_expediente': '18:00',
                'pausa_duracao': '01:00:00',
            },
            **csrf(),
        )
        assert resposta.status_code == 409


class TestStatusPagamentos:
    async def test_get_200_logado(self, client, fake_db, as_user):
        fake_db.queue_fetch([{'id': 1, 'nome': 'Pago'}])
        resposta = await client.get('/api/v1/status-pagamentos')
        assert resposta.status_code == 200
        assert 'status_pagamentos' in resposta.json()

    async def test_post_403_comum(self, client, fake_db, as_user):
        resposta = await client.post(
            '/api/v1/status-pagamentos',
            json={'nome': 'Pago'},
            **csrf(),
        )
        assert resposta.status_code == 403

    async def test_post_201_admin(self, client, fake_db, as_admin):
        fake_db.queue_fetchrow(None, {'id': 1, 'nome': 'Pago'})
        resposta = await client.post(
            '/api/v1/status-pagamentos',
            json={'nome': 'Pago'},
            **csrf(),
        )
        assert resposta.status_code == 201


class TestRotasComplementares:
    async def test_patch_administrador_200(self, client, fake_db, as_admin):
        fake_db.queue_fetchrow(
            {'id': 1},
            {
                'id': 1,
                'nome': 'Bia',
                'email': 'b@mail.com',
                'password': 'h',
                'type_user_id': 1,
                'nail_design_id': None,
            },
        )
        resposta = await client.patch(
            '/api/v1/administradores/1',
            json={'nome': 'Bia'},
            **csrf(),
        )
        assert resposta.status_code == 200

    async def test_get_agendamentos_200(self, client, fake_db, as_user):
        fake_db.queue_fetch(
            [
                {
                    'id': 1,
                    'cliente_id': 1,
                    'modelo_id': 2,
                    'horario': time(9, 0),
                    'sinal': 50.0,
                    'status_pagamentos_id': 5,
                }
            ]
        )
        resposta = await client.get('/api/v1/agendamentos')
        assert resposta.status_code == 200
        assert 'agendamentos' in resposta.json()

    async def test_patch_agendamento_200_admin(
        self, client, fake_db, as_admin
    ):
        fake_db.queue_fetchrow(
            AGENDAMENTO_ROW, None, AGENDAMENTO_ROW
        )
        resposta = await client.patch(
            '/api/v1/agendamentos/1',
            json={'horario': '11:00:00'},
            **csrf(),
        )
        assert resposta.status_code == 200

    async def test_patch_modelo_200(self, client, fake_db, as_admin):
        fake_db.queue_fetchrow(MODELO_ROW, MODELO_ROW)
        resposta = await client.patch(
            '/api/v1/modelos-unhas/1',
            json={'descricao': 'Nova'},
            **csrf(),
        )
        assert resposta.status_code == 200

    async def test_patch_delete_nail_design_200(
        self, client, fake_db, as_admin
    ):
        row = {'id': 1, 'nome': 'Ana', 'cpf': '123', 'telefone': '111'}
        fake_db.queue_fetchrow(row, row)
        resposta = await client.patch(
            '/api/v1/nail-designs/1', json={'nome': 'Bia'}, **csrf()
        )
        assert resposta.status_code == 200

        fake_db.queue_fetchrow(row, row)
        resposta = await client.delete(
            '/api/v1/nail-designs/1', **csrf()
        )
        assert resposta.status_code == 200

    async def test_patch_delete_programacao_200(
        self, client, fake_db, as_admin
    ):
        row = {
            'id': 1,
            'profissional_id': 1,
            'dia_semana': 'Segunda',
            'ativo': True,
            'inicio_expediente': '09:00',
            'fim_expediente': '18:00',
            'pausa_duracao': time(1, 0),
        }
        fake_db.queue_fetchrow(row, row)
        resposta = await client.patch(
            '/api/v1/programacao-semanal/1',
            json={'ativo': False},
            **csrf(),
        )
        assert resposta.status_code == 200
        fake_db.queue_fetchrow(row, row)
        resposta = await client.delete(
            '/api/v1/programacao-semanal/1', **csrf()
        )
        assert resposta.status_code == 200

    async def test_patch_delete_status_200(
        self, client, fake_db, as_admin
    ):
        fake_db.queue_fetchrow(
            {'id': 1, 'nome': 'Pago'}, None, {'id': 1, 'nome': 'Pago'}
        )
        resposta = await client.patch(
            '/api/v1/status-pagamentos/1',
            json={'nome': 'Pago'},
            **csrf(),
        )
        assert resposta.status_code == 200

        fake_db.queue_fetchrow({'id': 1, 'nome': 'Pago'}, {'id': 1})
        resposta = await client.delete(
            '/api/v1/status-pagamentos/1', **csrf()
        )
        assert resposta.status_code == 200

    async def test_refresh_tipo_errado_401(self, client, fake_db):
        from api.security import create_access_token

        token = await create_access_token(
            {'sub': 'a@mail.com', 'type_user_id': 2}
        )
        resposta = await client.post(
            '/api/v1/login/auth/refresh',
            headers=CSRF_HEADERS,
            cookies={'refresh_token': token, **CSRF_COOKIES},
        )
        assert resposta.status_code == 401

    async def test_refresh_token_invalido_401(self, client):
        resposta = await client.post(
            '/api/v1/login/auth/refresh',
            headers=CSRF_HEADERS,
            cookies={'refresh_token': 'invalido', **CSRF_COOKIES},
        )
        assert resposta.status_code in (401, 422)


class TestHealth:
    async def test_health_200_sem_auth(self, client):
        resposta = await client.get('/health')
        assert resposta.status_code == 200
        assert resposta.json()['status'] == 'ok'

    async def test_ready_503_sem_pool(self, client):
        ## SEM LIFESPAN NOS TESTES: POOL AUSENTE = DEGRADED
        resposta = await client.get('/health/ready')
        assert resposta.status_code == 503
        assert resposta.json()['database'] == 'down'


class TestPasswordResetRotas:
    async def test_recuperar_202(self, client, fake_db):
        from tests.conftest import CSRF_COOKIES, CSRF_HEADERS

        fake_db.queue_fetchrow(None)
        resposta = await client.post(
            '/api/v1/login/recuperar/',
            json={'email': 'ninguem@mail.com'},
            headers=CSRF_HEADERS,
            cookies=CSRF_COOKIES,
        )
        assert resposta.status_code == 202

    async def test_recuperar_email_invalido_422(self, client, fake_db):
        from tests.conftest import CSRF_COOKIES, CSRF_HEADERS

        resposta = await client.post(
            '/api/v1/login/recuperar/',
            json={'email': 'nao-e-email'},
            headers=CSRF_HEADERS,
            cookies=CSRF_COOKIES,
        )
        assert resposta.status_code == 422

    async def test_redefinir_token_invalido_400(self, client, fake_db):
        from tests.conftest import CSRF_COOKIES, CSRF_HEADERS

        fake_db.queue_fetch([])
        resposta = await client.post(
            '/api/v1/login/redefinir/',
            json={
                'token': 'token-inexistente-1234567890',
                'nova_senha': 'NovaSenha123',
            },
            headers=CSRF_HEADERS,
            cookies=CSRF_COOKIES,
        )
        assert resposta.status_code == 400

    async def test_redefinir_senha_curta_422(self, client, fake_db):
        from tests.conftest import CSRF_COOKIES, CSRF_HEADERS

        resposta = await client.post(
            '/api/v1/login/redefinir/',
            json={'token': 'x' * 32, 'nova_senha': 'curta'},
            headers=CSRF_HEADERS,
            cookies=CSRF_COOKIES,
        )
        assert resposta.status_code == 422

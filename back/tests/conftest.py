import os

## ENV DUMMY PARA IMPORTAR A APP SEM BANCO REAL
os.environ.setdefault('DATABASE_URL', 'postgresql://u:p@localhost:5432/db')
os.environ.setdefault('SECRET_KEY', 'segredo-de-teste')
os.environ.setdefault('CLIENT_ID', '1')
os.environ.setdefault('ACCESS_TOKEN', 'x')
os.environ.setdefault('ACCESS_TOKEN_EXPIRE_MINUTES', '30')
os.environ.setdefault('ALGORITHM', 'HS256')
os.environ.setdefault('FRONTEND_URL', 'http://localhost:5173')
os.environ.setdefault('MERCADO_PAGO_ACCESS_TOKEN', 'x')
os.environ.setdefault('MERCADO_PAGO_PUBLIC_KEY', 'x')
os.environ.setdefault('MERCADO_PAGO_WEBHOOK_ACESS_TOKEN', 'x')
os.environ.setdefault('SMPT_USER', 'x')
os.environ.setdefault('SMTP_PASSORD', 'x')
os.environ.setdefault('SMTP_HOST', 'x')
os.environ.setdefault('SMTP_FROM', 'x')
os.environ.setdefault('SMTP_PORT', '587')
os.environ.setdefault('SMTP_USE_TLS', 'false')
os.environ.setdefault('SMTP_USE_SSL', 'false')
os.environ.setdefault('COOKIE_SECURE', 'false')
os.environ.setdefault('COOKIE_SAMESITE', 'lax')
os.environ.setdefault('REFRESH_TOKEN_EXPIRE_DAYS', '7')
os.environ.setdefault('APP_PUBLIC_URL', 'http://localhost:8045')
os.environ.setdefault('CORS_ORIGINS', 'http://localhost:5173')
os.environ.setdefault('WHATSAPP_ACESS_TOKEN', 'x')
os.environ.setdefault('WHATSAPP_SECRET_KEY', 'x')

from collections import deque
from typing import Any

import httpx
import pytest
import pytest_asyncio

from api.app import app
from api.database import get_db
from api.schemas.global_schemas import UsuarioLogado
from api.security import get_current_user

CSRF_TOKEN = 'token-csrf-de-teste'
CSRF_HEADERS = {'X-CSRF-Token': CSRF_TOKEN}
CSRF_COOKIES = {'csrf_token': CSRF_TOKEN}


class FakeConnection:
    ## CONEXÃO FAKE QUE IMITA O asyncpg: FILAS DE RESULTADOS
    ## E REGISTRO DAS QUERIES PARA ASSERTS

    def __init__(self):
        self.calls: list[tuple] = []
        self.fetch_queue: deque = deque()
        self.fetchrow_queue: deque = deque()
        self.fetch_default: list = []
        self.fetchrow_default: Any = None

    def queue_fetch(self, *results):
        for result in results:
            self.fetch_queue.append(result)
        return self

    def queue_fetchrow(self, *results):
        for result in results:
            self.fetchrow_queue.append(result)
        return self

    async def fetch(self, query, *args):
        self.calls.append(('fetch', query, args))
        if self.fetch_queue:
            return self.fetch_queue.popleft()
        return self.fetch_default

    async def fetchrow(self, query, *args):
        self.calls.append(('fetchrow', query, args))
        if self.fetchrow_queue:
            return self.fetchrow_queue.popleft()
        return self.fetchrow_default

    def queries(self, method='fetchrow'):
        return [call[1] for call in self.calls if call[0] == method]

    def args_of(self, index=0, method='fetchrow'):
        chamadas = [call for call in self.calls if call[0] == method]
        return chamadas[index][2]


@pytest.fixture
def fake_db():
    return FakeConnection()


@pytest.fixture(autouse=True)
def override_db(fake_db):
    ## TODO TESTE USA O BANCO FAKE NO LUGAR DO POOL REAL
    app.dependency_overrides[get_db] = lambda: fake_db
    yield fake_db
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)


def login_as(usuario: UsuarioLogado | None):
    ## TROCA O USUÁRIO LOGADO (OU REMOVE A SESSÃO COM None)
    if usuario is None:
        app.dependency_overrides.pop(get_current_user, None)
    else:
        app.dependency_overrides[get_current_user] = lambda: usuario


@pytest.fixture
def admin_user():
    return UsuarioLogado(
        id=1,
        email='ana.clara@anaclaranails.com',
        password='hash-fake',
        type_user_id=1
    )


@pytest.fixture
def comum_user():
    return UsuarioLogado(
        id=2,
        email='maria.eduarda@email.com',
        password='hash-fake',
        type_user_id=2
    )


@pytest.fixture
def as_admin(admin_user):
    login_as(admin_user)
    return admin_user


@pytest.fixture
def as_user(comum_user):
    login_as(comum_user)
    return comum_user


@pytest.fixture
def as_anon():
    login_as(None)
    return None


@pytest_asyncio.fixture
async def client():
    ## CLIENTE ASGI SEM LIFESPAN (SEM BANCO REAL)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url='http://teste'
    ) as ac:
        yield ac

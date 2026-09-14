from http import HTTPStatus

import pytest
from fastapi import HTTPException

from api.repositories.administradores_repository import (
    AdministradoresRepository,
)
from api.repositories.agendamentos_repository import AgendamentosRepository
from api.repositories.clientes_repository import ClientesRepository
from api.repositories.modelos_unhas_repository import ModelosUnhasRepository
from api.repositories.nail_designs_repository import NailDesingsRepository
from api.repositories.programacao_semanal_repository import (
    ProgramacaoSemanalRepository,
)
from api.repositories.sql_repository import QueryRepository, SqlQueryBuilder
from api.repositories.status_pagamentos_repository import (
    StatusPagementosRepository,
)
from api.repositories.token_repository import LoginForAccessTokenRepository
from api.repositories.usuarios_repository import UsuarioRepository
from api.schemas.administradores_schemas import AdministradorFilter
from api.schemas.agendamentos_schemas import AgendamentoFilter
from api.schemas.clientes_schemas import ClienteFilter
from api.schemas.enums import Operador
from api.schemas.modelos_unhas_schemas import ModeloUnhaFilter
from api.schemas.nails_designs_schemas import NailDesignFilter
from api.schemas.programacao_semanal_schemas import (
    ProgramacaoSemanalFilter,
)
from api.schemas.status_pagamentos_schemas import StatusPagamentoFilter
from api.schemas.usuarios_schemas import UsuarioFilter


class TestSqlQueryBuilder:
    def test_filtrar_ignora_none_e_vazio(self):
        builder = SqlQueryBuilder('tabela', ['id'])
        builder.filtrar('nome', None, Operador.IGUAL)
        builder.filtrar('nome', '', Operador.ILIKE)
        query, params = builder.build_query()
        assert 'AND' not in query
        assert params == []

    def test_filtrar_ilike_envolve_com_percentual(self):
        builder = SqlQueryBuilder('tabela', ['id'])
        builder.filtrar('nome', 'ana', Operador.ILIKE)
        query, params = builder.build_query()
        assert 'nome ILIKE $1' in query
        assert params == ['%ana%']

    def test_filtrar_igualdade(self):
        builder = SqlQueryBuilder('tabela', ['id'])
        builder.filtrar('id', 7, Operador.IGUAL)
        query, params = builder.build_query()
        assert 'id = $1' in query
        assert params == [7]

    def test_paginacao(self):
        builder = SqlQueryBuilder('tabela', ['id'])
        builder.paginacao(20, 10)
        query, params = builder.build_query()
        assert 'OFFSET $1 LIMIT $2' in query
        assert params == [20, 10]

    def test_build_update(self):
        builder = SqlQueryBuilder('tabela', ['id', 'nome'])
        builder.definir('nome', 'Ana')
        builder.filtrar('id', 1, Operador.IGUAL)
        query, params = builder.builder_update()
        assert query.startswith('UPDATE tabela SET nome = $1')
        assert 'WHERE id = $2' in query
        assert 'RETURNING id, nome' in query
        assert params == ['Ana', 1]

    def test_build_insert(self):
        builder = SqlQueryBuilder('tabela', ['nome'])
        query, params = builder.build_insert({'nome': 'Ana'})
        assert 'INSERT INTO tabela' in query
        assert 'RETURNING id, nome' in query
        assert params == ['Ana']

    def test_build_insert_vazio_retorna_400(self):
        builder = SqlQueryBuilder('tabela', ['nome'])
        with pytest.raises(HTTPException) as exc:
            builder.build_insert({})
        assert exc.value.status_code == HTTPStatus.BAD_REQUEST


class FakeRepo(QueryRepository):
    table_name = 'fake'
    campos = {'id', 'nome'}
    mapa_filtros = {'nome': Operador.ILIKE}


class TestQueryRepository:
    async def test_buscar_monta_select_com_filtros_e_paginacao(
        self, fake_db
    ):
        fake_db.queue_fetch([{'id': 1, 'nome': 'Ana'}])
        repo = FakeRepo()

        resultado = await repo.buscar(
            fake_db, UsuarioFilter(email='ana@mail.com')
        )

        assert resultado == [{'id': 1, 'nome': 'Ana'}]
        query = fake_db.queries('fetch')[0]
        assert 'FROM fake' in query
        assert 'OFFSET' in query and 'LIMIT' in query

    async def test_buscar_por_id_encontrado_e_ausente(self, fake_db):
        repo = FakeRepo()
        fake_db.queue_fetchrow({'id': 3, 'nome': 'Ana'})
        assert await repo.buscar_por_id(fake_db, 3) == {
            'id': 3,
            'nome': 'Ana',
        }

        fake_db.queue_fetchrow(None)
        assert await repo.buscar_por_id(fake_db, 99) is None

    async def test_buscar_por_email(self, fake_db):
        repo = FakeRepo()
        fake_db.queue_fetchrow({'id': 1})
        resultado = await repo.buscar_por_email(fake_db, 'a@mail.com')
        assert resultado == {'id': 1}
        assert 'WHERE email = $1' in fake_db.queries('fetchrow')[0]

    async def test_buscar_status_id(self, fake_db):
        repo = FakeRepo()
        fake_db.queue_fetchrow({'id': 4})
        assert await repo.buscar_status_id(fake_db, 'Pago') == 4

        fake_db.queue_fetchrow(None)
        assert await repo.buscar_status_id(fake_db, 'X') is None

    async def test_existe(self, fake_db):
        repo = FakeRepo()
        fake_db.queue_fetchrow({'id': 1})
        assert await repo.existe(fake_db, 'nome', 'Ana') is True

        fake_db.queue_fetchrow(None)
        assert await repo.existe(fake_db, 'nome', 'Bia') is False

    async def test_existe_conflito(self, fake_db):
        repo = FakeRepo()
        fake_db.queue_fetchrow({'id': 1})
        assert (
            await repo.existe_conflito(fake_db, {'nome': 'Ana'}) is True
        )

        fake_db.queue_fetchrow(None)
        assert (
            await repo.existe_conflito(
                fake_db, {'nome': 'Bia'}, excluir_id=5
            )
            is False
        )
        assert 'id != $' in fake_db.queries('fetchrow')[-1]

    async def test_existe_conflito_sem_filtros_retorna_400(self, fake_db):
        with pytest.raises(HTTPException) as exc:
            await FakeRepo().existe_conflito(fake_db, {})
        assert exc.value.status_code == HTTPStatus.BAD_REQUEST

    async def test_criar(self, fake_db):
        fake_db.queue_fetchrow({'id': 9, 'nome': 'Ana'})
        resultado = await FakeRepo().criar(fake_db, {'nome': 'Ana'})
        assert resultado == {'id': 9, 'nome': 'Ana'}
        assert 'INSERT INTO fake' in fake_db.queries('fetchrow')[0]

    async def test_atualizar(self, fake_db):
        fake_db.queue_fetchrow({'id': 1, 'nome': 'Bia'})
        resultado = await FakeRepo().atualizar(
            fake_db, 1, {'nome': 'Bia'}
        )
        assert resultado == {'id': 1, 'nome': 'Bia'}
        assert 'UPDATE fake SET' in fake_db.queries('fetchrow')[0]

    async def test_atualizar_sem_dados_retorna_none(self, fake_db):
        assert await FakeRepo().atualizar(fake_db, 1, {}) is None
        assert fake_db.calls == []

    async def test_deletar(self, fake_db):
        fake_db.queue_fetchrow({'id': 1, 'nome': 'Ana'})
        resultado = await FakeRepo().deletar(fake_db, 1)
        assert resultado == {'id': 1, 'nome': 'Ana'}
        assert 'DELETE FROM fake' in fake_db.queries('fetchrow')[0]

        fake_db.queue_fetchrow(None)
        assert await FakeRepo().deletar(fake_db, 2) is None


REPOSITORIOS = [
    (UsuarioRepository, 'usuarios', UsuarioFilter()),
    (AdministradoresRepository, 'administradores', AdministradorFilter()),
    (ClientesRepository, 'clientes', ClienteFilter()),
    (AgendamentosRepository, 'agendamentos', AgendamentoFilter()),
    (ModelosUnhasRepository, 'modelos_unhas', ModeloUnhaFilter()),
    (NailDesingsRepository, 'nail_designs', NailDesignFilter()),
    (
        ProgramacaoSemanalRepository,
        'programacao_semanal',
        ProgramacaoSemanalFilter(),
    ),
    (
        StatusPagementosRepository,
        'status_pagamentos',
        StatusPagamentoFilter(),
    ),
    (
        LoginForAccessTokenRepository,
        'usuarios',
        UsuarioFilter(),
    ),
]


@pytest.mark.parametrize(
    'repo_classe,tabela,filtro', REPOSITORIOS
)
class TestRepositoriosDominios:
    def test_atributos_da_tabela(self, repo_classe, tabela, filtro):
        repo = repo_classe()
        assert repo.table_name == tabela
        assert 'id' in repo.campos
        assert isinstance(repo.mapa_filtros, dict)

    async def test_buscar_usa_tabela_correta(
        self, repo_classe, tabela, filtro, fake_db
    ):
        fake_db.queue_fetch([{'id': 1}])
        resultado = await repo_classe().buscar(fake_db, filtro)
        assert resultado == [{'id': 1}]
        assert f'FROM {tabela}' in fake_db.queries('fetch')[0]

    async def test_criar_retorna_linha(
        self, repo_classe, tabela, filtro, fake_db
    ):
        fake_db.queue_fetchrow({'id': 5})
        resultado = await repo_classe().criar(fake_db, {'id': 5})
        assert resultado == {'id': 5}
        assert f'INSERT INTO {tabela}' in fake_db.queries('fetchrow')[0]

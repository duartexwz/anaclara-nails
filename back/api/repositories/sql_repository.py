from http import HTTPStatus
from typing import Any
from asyncpg import Connection
from fastapi import HTTPException
from pydantic import BaseModel

from api.schemas.enums import Operador, StatusPagamentoEnum, TypeUserEnum



class SqlQueryBuilder:

# Construtor de consultas SQL dinâmicas para o banco de dados PostgreSQL.
    def __init__(self, table_name: str, campos: list[str]):
        self.table_name = table_name
        self.campos = campos


        # Acumuladores que vão sendo preenchidos conforme os métodos são chamados.
        # Abaixo são chamados (padrão 'builder' / 'query encadeada')

        self.condicoes: list[str] = [] # Pedaços do WHERE
        self.params: list[Any] = [] # Valores que viram $1, $2, $3
        self.sets: list[str] = [] # Pedaços do SET
        self._paginacao = '' # Texto do OFFSET / LIMIT


    def __add_param(self, valor: Any) -> int:
        # Adiciona um valor na lista de parâmetros e devolve a posição dele
        # (Usada para montar o placeholder $N do asyncpg)

        self.params.append(valor)
        return len(self.params)

    def filtrar(
        self, campo: str,
        valor: Any,
        operador: Operador
    ) -> 'SqlQueryBuilder':

        # Adiciona uma condição ao WHERE (encadeável)

        if valor is None or valor == '':
            return self

        if operador == Operador.ILIKE:
            # ILIKE faz a busca parcial: envolve o valor com %...%
            param_valor = self.__add_param(f'%{valor}%')

        else:
            param_valor = self.__add_param(valor)

        self.condicoes.append(
            f'{campo} {operador.value} ${param_valor}'
        )

        return self

    def definir(self, campo: str, valor: Any) -> 'SqlQueryBuilder':
        # Adiciona uma atribuição 'campo = $N (usado no UPDATE)'

        param_valor = self.__add_param(valor)
        self.sets.append(f'{campo} = ${param_valor}')

        return self

    def paginacao(self, offset: int, limit: int) -> 'SqlQueryBuilder':
        # Configura a paginação da consulta (OFFSET / LIMIT)

        offset_param = self.__add_param(offset)
        limit_param = self.__add_param(limit)

        self._paginacao = f' OFFSET ${offset_param} LIMIT ${limit_param}'

        return self

    def build_query(self) -> tuple[str, list[Any]]:
         # Monta a query SELECT final a partir do que foi acumulado

        campos_str = ', '.join(self.campos)
        query = f'''
        SELECT {campos_str} 
        FROM {self.table_name}
        WHERE 1=1
        '''

        if self.condicoes:
            query += ' AND ' + ' AND '.join(self.condicoes)

        query += self._paginacao

        return query, self.params

    def builder_update(self) -> tuple[str, list[Any]]:

        # Monta a query UPDATE com final RETURNING

        set_str = ', '.join(self.sets)
        query = f'UPDATE {self.table_name} SET {set_str}'

        if self.condicoes:
            query += ' WHERE ' + ' AND '.join(self.condicoes)

        campos_str = ', '.join(self.campos)
        query += f' RETURNING {campos_str}'

        return query, self.params

    def build_insert(self, dados: dict[str, Any]) -> tuple[str, list[Any]]:

        # Monta a query INSERT dinâmica com base nas chaves do dict

        if not dados:
            raise HTTPException(
                detail='Nenhum campo para inserir',
                status_code=HTTPStatus.BAD_REQUEST
            )

        colunas = []
        placeholders = []

        for campo, valor in dados.items():
            params_index = self.__add_param(valor)
            colunas.append(campo)
            placeholders.append(f'${params_index}')


        campos_str = ', '.join(self.campos)
        query = f'''
        INSERT INTO {self.table_name} ({', '.join(colunas)})
        VALUES ({', '.join(placeholders)})
        RETURNING id, {campos_str}
        '''

        return query, self.params

class QueryRepository:
    # Base genérica para os repositórios de cada tabela do sistema


    table_name: str
    campos: list[str]
    mapa_filtros: dict[str, Operador] = {}

    async def buscar(
        self,
        db: Connection,
        filtro: BaseModel
    ) -> list[dict]:

        # LIsta de registros aplicando os filtros do schema recebido
        builder = SqlQueryBuilder(self.table_name, self.campos)

        dados = filtro.model_dump(exclude={'offset', 'limit'})

        for campo, valor in dados.items():
            operador = self.mapa_filtros.get(campo, Operador.IGUAL)
            builder.filtrar(campo, valor, operador)

        builder.paginacao(filtro.offset, filtro.limit)
        query, params = builder.build_query()

        resultado = await db.fetch(query, *params)
        return [dict(row) for row in resultado]


    async def buscar_por_id(
        self,
        db: Connection,
        id_valor: Any
    ) -> dict | None:

        # Faz uma busca por id na tabela informada

        campo_str = ', '.join(self.campos)
        query = f'''
        SELECT {campo_str}
        FROM {self.table_name}
        WHERE id = $1
        '''

        resultado = await db.fetchrow(query, id_valor)

        return dict(resultado) if resultado else None

    async def buscar_status_id(
        self, db: Connection,
        status: str
    ) -> int | None:

        # Busca o id de um status pelo nome (ex: Pago)

        query = '''
        SELECT id FROM status_pagamentos
        WHERE nome = $1
        '''

        resultado = await db.fetchrow(query, status)

        return resultado['id'] if resultado else None


    async def buscar_por_email(
        self,
        db: Connection,
        email: str
    ) -> dict | None:

        # Monta a query para o email

        campo_str = ', '.join(self.campos)
        query = f'''
        SELECT {campo_str} FROM {self.table_name}
        WHERE email = $1
        '''

        resultado = await db.fetchrow(query,email)

        return dict(resultado) if resultado else None


    async def existe(
        self,
        db: Connection,
        campo: str,
        valor: Any,
        excluir_id: Any = None
    ) -> bool:

        # Verifica se o registro já existe na coluna

        condicao = f'{campo} = $1'

        params: list[Any] = [valor]

        if excluir_id is not None:
            condicao += ' AND id != $2'
            params.append(excluir_id)

        query = f'''
        SELECT id FROM {self.table_name} WHERE {condicao}
        '''

        resultado = await db.fetchrow(query, *params)

        return resultado is not None

    async def existe_conflito(
        self,
        db: Connection,
        filtros: dict[str, Any],
        excluir_id: Any = None
    ) -> bool:

        # Verifica se existe um registro que combine com TODOS
        # campos informados simultâneamente, diferente do 
        # existe(), que nunca checa todos os campos de uma vez
    
        if not filtros:
            raise HTTPException(
                detail='Nenhum campo informado para validar',
                status_code=HTTPStatus.BAD_REQUEST
            )

        condicoes: list[str] = []
        params: list[Any] =[]

        for campo, valor in filtros.items():
            params.append(valor)
            condicoes.append(f'{campo} = ${len(params)}')

        if excluir_id is not None:
            params.append(excluir_id)
            condicoes.append(f'id != ${len(params)}')

        query = f'''
        SELECT id FROM {self.table_name}
        WHERE {' AND '.join(condicoes)}
        '''

        resultado = await db.fetchrow(query, *params)

        return resultado is not None

    async def criar(
        self,
        db: Connection,
        dados: dict[str, Any]
    ) -> dict | None:

        # Cria o INSERT no banco com os parametros passados

        builder = SqlQueryBuilder(self.table_name, self.campos)
        query, params = builder.build_insert(dados)

        resultado = await db.fetchrow(query, *params)

        return dict(resultado) if resultado else None



    async def atualizar(
        self,
        db: Connection,
        id_valor: Any,
        dados: dict[str, Any]
    ) -> dict | None:

        # cria o UPDATE com os parametros passados 


        if not dados:
            return None

        builder = SqlQueryBuilder(self.table_name, self.campos)

        for campo, valor in dados.items():
            builder.definir(campo, valor)
        builder.filtrar('id', id_valor, Operador.IGUAL)

        query, params = builder.builder_update()
        resultado = await db.fetchrow(query, *params)

        return dict(resultado) if resultado else None

    
    async def deletar(
        self,
        db: Connection,
        id_valor: Any
    ) -> dict | None:

        # cria o DELETE com o id passado


        query = f'''
        DELETE FROM {self.table_name}
        WHERE id = $1
        RETURNING *
        '''

        resultado = await db.fetchrow(query, id_valor)

        return dict(resultado) if resultado else None
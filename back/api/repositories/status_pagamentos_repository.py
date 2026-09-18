from api.repositories.sql_repository import QueryRepository
from api.schemas.enums import Operador


class StatusPagamentosRepository(QueryRepository):
    table_name = 'status_pagamentos'
    campos = {
        'id',
        'nome'
    }

    mapa_filtros = {
        'id': Operador.IGUAL,
        'nome': Operador.ILIKE
    }
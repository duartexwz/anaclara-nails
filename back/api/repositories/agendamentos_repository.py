from api.repositories.sql_repository import QueryRepository
from api.schemas.enums import Operador


class AgendamentosRepository(QueryRepository):
    table_name = 'agendamentos'
    campos = {
        'id',
        'cliente_id',
        'modelo_id',
        'horario',
        'sinal',
        'status_pagamentos_id',
        'data'
    }


    mapa_filtros ={ 
        'id': Operador.IGUAL,
        'cliente_id': Operador.IGUAL,
        'modelo_id': Operador.IGUAL,
        'horario': Operador.IGUAL,
        'sinal': Operador.IGUAL,
        'status_pagamentos_id': Operador.IGUAL
    }
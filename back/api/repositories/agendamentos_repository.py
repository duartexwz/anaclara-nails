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
        'id': Operador.ILIKE,
        'cliente_id': Operador.ILIKE,
        'modelo_id': Operador.ILIKE,
        'horario': Operador.ILIKE,
        'sinal': Operador.ILIKE,
        'status_pagamentos_id': Operador.ILIKE
    }
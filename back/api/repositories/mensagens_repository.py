from api.repositories.sql_repository import QueryRepository
from api.schemas.enums import Operador


class MensagensRepository(QueryRepository):
    table_name = 'mensagens'
    campos = {
        'id',
        'agendamento_id',
        'remetente',
        'texto',
        'lida'
    }

    mapa_filtros = {
        'id': Operador.IGUAL,
        'agendamento_id': Operador.IGUAL,
        'remetente': Operador.IGUAL
    }

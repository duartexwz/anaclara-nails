from api.repositories.sql_repository import QueryRepository
from api.schemas.enums import Operador


class NotificacoesRepository(QueryRepository):
    table_name = 'notificacoes'
    campos = {
        'id',
        'tipo',
        'titulo',
        'mensagem',
        'agendamento_id',
        'lida',
        'created_at'
    }

    mapa_filtros = {
        'id': Operador.IGUAL,
        'tipo': Operador.IGUAL,
        'titulo': Operador.ILIKE,
        'lida': Operador.IGUAL,
        'agendamento_id': Operador.IGUAL
    }

from api.repositories.sql_repository import QueryRepository
from api.schemas.enums import Operador


class PushSubscriptionsRepository(QueryRepository):
    table_name = 'push_subscriptions'
    campos = {
        'id',
        'endpoint',
        'p256dh',
        'auth',
        'usuario_id'
    }

    mapa_filtros = {
        'id': Operador.IGUAL,
        'endpoint': Operador.IGUAL,
        'usuario_id': Operador.IGUAL
    }

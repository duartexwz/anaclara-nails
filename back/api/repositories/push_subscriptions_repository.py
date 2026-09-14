from api.repositories.sql_repository import QueryRepository
from api.schemas.enums import Operador


class PushSubscriptionsRepository(QueryRepository):
    table_name = 'push_subscriptions'
    campos = {
        'id',
        'endpoint',
        'p256dh',
        'auth'
    }

    mapa_filtros = {
        'id': Operador.IGUAL,
        'endpoint': Operador.IGUAL
    }

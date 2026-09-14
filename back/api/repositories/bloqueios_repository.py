from api.repositories.sql_repository import QueryRepository
from api.schemas.enums import Operador


class BloqueiosRepository(QueryRepository):
    table_name = 'bloqueios'
    campos = {
        'id',
        'data',
        'motivo'
    }

    mapa_filtros = {
        'id': Operador.IGUAL
    }

from api.repositories.sql_repository import QueryRepository
from api.schemas.enums import Operador

class LoginForAccessTokenRepository(QueryRepository):
    table_name = 'usuarios'
    campos = {
        'id',
        'nome',
        'email',
        'password',
        'type_user_id'
    }

    mapa_filtros = {
        'id': Operador.IGUAL,
        'email': Operador.ILIKE,
        'password': Operador.ILIKE,
        'type_user_id': Operador.IGUAL
    }
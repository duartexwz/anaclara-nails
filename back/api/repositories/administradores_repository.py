from api.repositories.sql_repository import QueryRepository
from api.schemas.enums import Operador

class AdministradoresRepository(QueryRepository):
    table_name = 'administradores'
    campos = {
        'id',
        'nome',
        'email',
        'password',
        'type_user_id',
        'nail_design_id',
    }

    mapa_filtros = {
        'id': Operador.IGUAL,
        'nome': Operador.ILIKE,
        'email': Operador.ILIKE,
        'password': Operador.ILIKE,
        'type_user_id': Operador.IGUAL,
        'nail_design_id': Operador.IGUAL
    }
from api.repositories.sql_repository import QueryRepository
from api.schemas.enums import Operador

class NailDesingnsRepository(QueryRepository):
    table_name = 'nail_designs'
    campos = {
        'id',
        'nome',
        'cpf',
        'telefone'
    }

    mapa_filtros = {
        'id': Operador.IGUAL,
        'nome': Operador.ILIKE,
        'cpf': Operador.ILIKE,
        'telefone': Operador.ILIKE
    }
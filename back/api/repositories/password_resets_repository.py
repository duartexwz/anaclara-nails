from api.repositories.sql_repository import QueryRepository
from api.schemas.enums import Operador


class PasswordResetsRepository(QueryRepository):
    table_name = 'password_resets'
    campos = {
        'id',
        'usuario_id',
        'token_hash',
        'expira_em',
        'usado_em'
    }

    mapa_filtros = {
        'id': Operador.IGUAL,
        'usuario_id': Operador.IGUAL,
        'token_hash': Operador.IGUAL
    }

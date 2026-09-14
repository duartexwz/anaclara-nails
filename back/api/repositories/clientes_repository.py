from api.repositories.sql_repository import QueryRepository
from api.schemas.enums import Operador


class ClientesRepository(QueryRepository):
    table_name = 'clientes'
    campos = {
        'id',
        'nome',
        'telefone',
        'email_id',
        'molde',
        'cpf',
        'data_nascimento',
        'pref_app',
        'pref_email',
        'pref_whatsapp'
    }

    mapa_filtros = {
        'id': Operador.ILIKE,
        'nome': Operador.IGUAL,
        'telefone': Operador.IGUAL,
        'email_id': Operador.ILIKE
    }
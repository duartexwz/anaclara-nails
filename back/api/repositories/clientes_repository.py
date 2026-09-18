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
        'id': Operador.IGUAL,
        'nome': Operador.ILIKE,
        'telefone': Operador.ILIKE,
        'email_id': Operador.IGUAL,
        'molde': Operador.ILIKE,
        'cpf': Operador.ILIKE,
        'data_nascimento': Operador.ILIKE,
        'pref_app': Operador.IGUAL,
        'pref_email': Operador.IGUAL,
        'pref_whatsapp': Operador.IGUAL
    }
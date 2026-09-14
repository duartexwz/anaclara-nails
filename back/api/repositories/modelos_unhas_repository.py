from api.repositories.sql_repository import QueryRepository
from api.schemas.enums import Operador

class ModelosUnhasRepository(QueryRepository):
    table_name = 'modelos_unhas'
    campos = {
        'id',
        'nome',
        'valor_total',
        'categoria',
        'descricao',
        'duracao',
        'imagem_url',
        'ativo',
        'destaque'
    }

    mapa_filtros = {
        'id': Operador.ILIKE,
        'nome': Operador.IGUAL,
        'valor_total': Operador.ILIKE,
        'categoria': Operador.IGUAL,
        'descricao': Operador.IGUAL,
        'duracao': Operador.IGUAL
    }
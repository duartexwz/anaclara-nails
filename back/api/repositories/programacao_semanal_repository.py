from api.repositories.sql_repository import QueryRepository
from api.schemas.enums import Operador


class ProgramacaoSemanalRepository(QueryRepository):
    table_name = 'programacao_semanal'
    campos = {
        'id',
        'profissional_id',
        'dia_semana',
        'ativo',
        'inicio_expediente',
        'fim_expediente',
        'pausa_duracao',
        'intervalo_minutos'
    }

    mapa_filtros = {
        'id': Operador.ILIKE,
        'profissional_id': Operador.ILIKE,
        'dia_semana': Operador.ILIKE,
        'ativo': Operador.ILIKE,
        'inicio_expediente': Operador.ILIKE,
        'fim_expediente': Operador.ILIKE,
        'pausa_duracao': Operador.ILIKE,
        'intervalo_minutos': Operador.IGUAL
    }
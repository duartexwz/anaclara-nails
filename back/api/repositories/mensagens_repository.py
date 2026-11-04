from asyncpg import Connection
from pydantic import BaseModel

from api.repositories.sql_repository import QueryRepository, SqlQueryBuilder
from api.schemas.enums import Operador


class MensagensRepository(QueryRepository):
    table_name = 'mensagens'
    campos = {
        'id',
        'agendamento_id',
        'cliente_id',
        'usuario_id',
        'remetente',
        'texto',
        'lida'
    }

    mapa_filtros = {
        'id': Operador.IGUAL,
        'agendamento_id': Operador.IGUAL,
        'cliente_id': Operador.IGUAL,
        'usuario_id': Operador.IGUAL,
        'remetente': Operador.IGUAL
    }

    async def buscar(
        self,
        db: Connection,
        filtro: BaseModel
    ) -> list[dict]:
        builder = SqlQueryBuilder(self.table_name, list(self.campos))

        dados = filtro.model_dump(exclude={'offset', 'limit'})

        for campo, valor in dados.items():
            operador = self.mapa_filtros.get(campo, Operador.IGUAL)
            builder.filtrar(campo, valor, operador)

        builder.paginacao(filtro.offset, filtro.limit)
        query, params = builder.build_query()

        # Enriquecimento com JOIN em clientes e usuarios para identificar nomes
        campos_join = (
            "m.id, m.agendamento_id, m.cliente_id, m.usuario_id, m.remetente, m.texto, m.lida, "
            "COALESCE(c.nome, u.nome, '') AS cliente_nome, "
            "COALESCE(u.nome, '') AS usuario_nome, "
            "COALESCE(u.email, '') AS usuario_email"
        )
        condicoes_str = ""
        if builder.condicoes:
            conds_prefixadas = []
            for c in builder.condicoes:
                if c.startswith("usuario_id =") or c.startswith("m.usuario_id ="):
                    placeholder = c.split("=")[1].strip()
                    conds_prefixadas.append(f"(m.usuario_id = {placeholder} OR c.email_id = {placeholder})")
                elif not (c.startswith("m.") or c.startswith("c.") or c.startswith("u.")):
                    conds_prefixadas.append(f"m.{c}")
                else:
                    conds_prefixadas.append(c)
            condicoes_str = " AND " + " AND ".join(conds_prefixadas)

        query_enriquecida = f"""
        SELECT {campos_join}
        FROM {self.table_name} m
        LEFT JOIN clientes c ON c.id = m.cliente_id
        LEFT JOIN usuarios u ON u.id = COALESCE(m.usuario_id, c.email_id)
        WHERE 1=1{condicoes_str}
        ORDER BY m.id ASC
        {builder._paginacao}
        """

        try:
            resultado = await db.fetch(query_enriquecida, *params)
        except Exception:
            resultado = await db.fetch(query, *params)

        return [dict(row) for row in resultado]

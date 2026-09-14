from http import HTTPStatus

from asyncpg import Connection
from fastapi import HTTPException

from api.repositories.status_pagamentos_repository import StatusPagementosRepository
from api.schemas.enums import TypeUserEnum
from api.schemas.global_schemas import UsuarioLogado
from api.schemas.status_pagamentos_schemas import (
    StatusPagamentoBase,
    StatusPagamentoFilter,
    StatusPagamentoUpdate,
)


# Cria a classe dos serviços de status de pagamentos (regras, validações e etc)
class StatusPagamentosServices:
    def __init__(self):
        self.status_pagamentos_repository = StatusPagementosRepository()


    async def create_status_pagamento(
        self,
        db: Connection,
        status_pagamento: StatusPagamentoBase,
        current_user: UsuarioLogado
    ) -> dict:

        if (
            current_user.type_user_id !=
            TypeUserEnum.ADMIN
        ):
            raise HTTPException(
                detail='A ação requer elevação',
                status_code=HTTPStatus.FORBIDDEN
            )

        if (
            status_pagamento.nome and await
            self.status_pagamentos_repository.existe(
                db, 'nome', status_pagamento.nome
            )
        ):
            raise HTTPException(
                detail='O nome já pertence a um status cadastrado',
                status_code=HTTPStatus.CONFLICT
            )

        dados = status_pagamento.model_dump()

        resultado = await self.status_pagamentos_repository.criar(
            db, dados
        )

        if resultado is None:
            raise HTTPException(
                detail='Erro ao cadastrar o status de pagamento',
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR
            )

        return resultado


    async def get_status_pagamentos(
        self,
        db: Connection,
        filtrar: StatusPagamentoFilter,
        current_user: UsuarioLogado
    ) -> dict:

        status_pagamentos = await self.status_pagamentos_repository.buscar(
            db, filtrar
        )

        if not status_pagamentos:
            raise HTTPException(
                detail='Status de pagamento não encontrado',
                status_code=HTTPStatus.NOT_FOUND
            )

        return status_pagamentos


    async def update_status_pagamento(
        self,
        db: Connection,
        status_pagamento_id: int,
        status_pagamento: StatusPagamentoUpdate,
        current_user: UsuarioLogado
    ) -> dict:

        if (
            current_user.type_user_id !=
            TypeUserEnum.ADMIN
        ):
            raise HTTPException(
                detail='A ação requer elevação',
                status_code=HTTPStatus.FORBIDDEN
            )

        atual = await self.status_pagamentos_repository.buscar_por_id(
            db, status_pagamento_id
        )

        if not atual:
            raise HTTPException(
                detail='Status de pagamento não encontrado',
                status_code=HTTPStatus.NOT_FOUND
            )

        dados = status_pagamento.model_dump(exclude_unset=True)

        if not dados:
            raise HTTPException(
                detail='Nenhum campo para atualizar',
                status_code=HTTPStatus.BAD_REQUEST
            )

        if (
            dados.get('nome') and await
            self.status_pagamentos_repository.existe(
                db, 'nome', dados['nome'],
                excluir_id=status_pagamento_id
            )
        ):
            raise HTTPException(
                detail='O nome já pertence a um status cadastrado',
                status_code=HTTPStatus.CONFLICT
            )

        resultado = await self.status_pagamentos_repository.atualizar(
            db, status_pagamento_id, dados
        )

        if resultado is None:
            raise HTTPException(
                detail='Erro ao atualizar o status de pagamento',
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR
            )

        return resultado


    async def delete_status_pagamento(
        self,
        db: Connection,
        status_pagamento_id: int,
        current_user: UsuarioLogado
    ) -> dict:

        if (
            current_user.type_user_id !=
            TypeUserEnum.ADMIN
        ):
            raise HTTPException(
                detail='A ação requer elevação',
                status_code=HTTPStatus.FORBIDDEN
            )

        atual = await self.status_pagamentos_repository.buscar_por_id(
            db, status_pagamento_id
        )

        if not atual:
            raise HTTPException(
                detail='Status de pagamento não encontrado',
                status_code=HTTPStatus.NOT_FOUND
            )

        resultado = await self.status_pagamentos_repository.deletar(
            db, status_pagamento_id
        )

        if resultado is None:
            raise HTTPException(
                detail='Erro ao deletar o status de pagamento',
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR
            )

        return {'message': 'Status de pagamento deletado com sucesso.'}

from http import HTTPStatus

from asyncpg import Connection
from fastapi import HTTPException

from api.repositories.nail_designs_repository import NailDesingsRepository
from api.schemas.enums import TypeUserEnum
from api.schemas.global_schemas import UsuarioLogado
from api.schemas.nails_designs_schemas import (
    NailDesignBase,
    NailDesignFilter,
    NailDesignUpdate,
)


# Cria a classe dos serviços de nail designs (regras, validações e etc)
class NailDesignsServices:
    def __init__(self):
        self.nail_designs_repository = NailDesingsRepository()


    async def create_nail_design(
        self,
        db: Connection,
        nail_design: NailDesignBase,
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
            nail_design.cpf and await
            self.nail_designs_repository.existe(
                db, 'cpf', nail_design.cpf
            )
        ):
            raise HTTPException(
                detail='O cpf já pertence a uma profissional cadastrada',
                status_code=HTTPStatus.CONFLICT
            )

        dados = nail_design.model_dump()

        resultado = await self.nail_designs_repository.criar(
            db, dados
        )

        if resultado is None:
            raise HTTPException(
                detail='Erro ao cadastrar a profissional',
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR
            )

        return resultado


    async def get_nail_designs(
        self,
        db: Connection,
        filtrar: NailDesignFilter,
        current_user: UsuarioLogado
    ) -> dict:

        nail_designs = await self.nail_designs_repository.buscar(
            db, filtrar
        )

        if not nail_designs:
            raise HTTPException(
                detail='Profissional não encontrada',
                status_code=HTTPStatus.NOT_FOUND
            )

        return nail_designs


    async def update_nail_design(
        self,
        db: Connection,
        nail_design_id: int,
        nail_design: NailDesignUpdate,
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

        atual = await self.nail_designs_repository.buscar_por_id(
            db, nail_design_id
        )

        if not atual:
            raise HTTPException(
                detail='Profissional não encontrada',
                status_code=HTTPStatus.NOT_FOUND
            )

        dados = nail_design.model_dump(exclude_unset=True)

        if not dados:
            raise HTTPException(
                detail='Nenhum campo para atualizar',
                status_code=HTTPStatus.BAD_REQUEST
            )

        if (
            dados.get('cpf') and await
            self.nail_designs_repository.existe(
                db, 'cpf', dados['cpf'],
                excluir_id=nail_design_id
            )
        ):
            raise HTTPException(
                detail='O cpf já pertence a uma profissional cadastrada',
                status_code=HTTPStatus.CONFLICT
            )

        resultado = await self.nail_designs_repository.atualizar(
            db, nail_design_id, dados
        )

        if resultado is None:
            raise HTTPException(
                detail='Erro ao atualizar a profissional',
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR
            )

        return resultado


    async def delete_nail_design(
        self,
        db: Connection,
        nail_design_id: int,
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

        atual = await self.nail_designs_repository.buscar_por_id(
            db, nail_design_id
        )

        if not atual:
            raise HTTPException(
                detail='Profissional não encontrada',
                status_code=HTTPStatus.NOT_FOUND
            )

        resultado = await self.nail_designs_repository.deletar(
            db, nail_design_id
        )

        if resultado is None:
            raise HTTPException(
                detail='Erro ao deletar a profissional',
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR
            )

        return {'message': 'Profissional deletada com sucesso.'}

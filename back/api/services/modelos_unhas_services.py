from http import HTTPStatus

from asyncpg import Connection
from fastapi import HTTPException

from api.repositories.modelos_unhas_repository import ModelosUnhasRepository
from api.schemas.enums import TypeUserEnum
from api.schemas.global_schemas import UsuarioLogado
from api.schemas.modelos_unhas_schemas import (
    ModeloUnhaBase,
    ModeloUnhaFilter,
    ModeloUnhaUpdate,
)


# Cria a classe dos serviços de modelos de unhas (regras, validações e etc)
class ModelosUnhasServices:
    def __init__(self):
        self.modelos_unhas_repository = ModelosUnhasRepository()


    async def create_modelo_unha(
        self,
        db: Connection,
        modelo_unha: ModeloUnhaBase,
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
            modelo_unha.nome and await
            self.modelos_unhas_repository.existe(
                db, 'nome', modelo_unha.nome
            )
        ):
            raise HTTPException(
                detail='O nome já pertence a um modelo cadastrado',
                status_code=HTTPStatus.CONFLICT
            )

        dados = modelo_unha.model_dump()

        resultado = await self.modelos_unhas_repository.criar(
            db, dados
        )

        if resultado is None:
            raise HTTPException(
                detail='Erro ao cadastrar o modelo de unha',
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR
            )

        return resultado


    async def get_modelos_unhas(
        self,
        db: Connection,
        filtrar: ModeloUnhaFilter
    ) -> dict:

        modelos_unhas = await self.modelos_unhas_repository.buscar(
            db, filtrar
        )

        if not modelos_unhas:
            raise HTTPException(
                detail='Modelo de unha não encontrado',
                status_code=HTTPStatus.NOT_FOUND
            )

        return modelos_unhas


    async def update_modelo_unha(
        self,
        db: Connection,
        modelo_unha_id: int,
        modelo_unha: ModeloUnhaUpdate,
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

        atual = await self.modelos_unhas_repository.buscar_por_id(
            db, modelo_unha_id
        )

        if not atual:
            raise HTTPException(
                detail='Modelo de unha não encontrado',
                status_code=HTTPStatus.NOT_FOUND
            )

        dados = modelo_unha.model_dump(exclude_unset=True)

        if not dados:
            raise HTTPException(
                detail='Nenhum campo para atualizar',
                status_code=HTTPStatus.BAD_REQUEST
            )

        if (
            dados.get('nome') and await
            self.modelos_unhas_repository.existe(
                db, 'nome', dados['nome'],
                excluir_id=modelo_unha_id
            )
        ):
            raise HTTPException(
                detail='O nome já pertence a um modelo cadastrado',
                status_code=HTTPStatus.CONFLICT
            )

        resultado = await self.modelos_unhas_repository.atualizar(
            db, modelo_unha_id, dados
        )

        if resultado is None:
            raise HTTPException(
                detail='Erro ao atualizar o modelo de unha',
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR
            )

        return resultado


    async def delete_modelo_unha(
        self,
        db: Connection,
        modelo_unha_id: int,
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

        atual = await self.modelos_unhas_repository.buscar_por_id(
            db, modelo_unha_id
        )

        if not atual:
            raise HTTPException(
                detail='Modelo de unha não encontrado',
                status_code=HTTPStatus.NOT_FOUND
            )

        resultado = await self.modelos_unhas_repository.deletar(
            db, modelo_unha_id
        )

        if resultado is None:
            raise HTTPException(
                detail='Erro ao deletar o modelo de unha',
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR
            )

        return {'message': 'Modelo de unha deletado com sucesso.'}

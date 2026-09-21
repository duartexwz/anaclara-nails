from http import HTTPStatus

from asyncpg import Connection
from asyncpg.exceptions import UniqueViolationError
from fastapi import HTTPException

from api.repositories.bloqueios_repository import BloqueiosRepository
from api.schemas.bloqueios_schemas import BloqueioBase, BloqueioFilter
from api.schemas.enums import TypeUserEnum
from api.schemas.global_schemas import UsuarioLogado


# Cria a classe dos serviços de bloqueios de agenda (regras, validações e etc)
class BloqueiosServices:
    def __init__(self):
        self.bloqueios_repository = BloqueiosRepository()


    async def create_bloqueio(
        self,
        db: Connection,
        bloqueio: BloqueioBase,
        current_user: UsuarioLogado
    ) -> dict:

        if (
            current_user.type_user_id !=
            TypeUserEnum.ADMIN.value
        ):
            raise HTTPException(
                detail='A ação requer elevação',
                status_code=HTTPStatus.FORBIDDEN
            )

        dados = bloqueio.model_dump()

        try:
            resultado = await self.bloqueios_repository.criar(
                db, dados
            )
        except UniqueViolationError as err:
            raise HTTPException(
                detail='Data já bloqueada',
                status_code=HTTPStatus.CONFLICT
            ) from err

        if resultado is None:
            raise HTTPException(
                detail='Erro ao cadastrar o bloqueio',
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR
            )

        return resultado


    async def get_bloqueios(
        self,
        db: Connection,
        filtrar: BloqueioFilter,
        current_user: UsuarioLogado
    ) -> dict:

        bloqueios = await self.bloqueios_repository.buscar(
            db, filtrar
        )

        return bloqueios


    async def delete_bloqueio(
        self,
        db: Connection,
        bloqueio_id: int,
        current_user: UsuarioLogado
    ) -> dict:

        if (
            current_user.type_user_id !=
            TypeUserEnum.ADMIN.value
        ):
            raise HTTPException(
                detail='A ação requer elevação',
                status_code=HTTPStatus.FORBIDDEN
            )

        atual = await self.bloqueios_repository.buscar_por_id(
            db, bloqueio_id
        )

        if not atual:
            raise HTTPException(
                detail='Bloqueio não encontrado',
                status_code=HTTPStatus.NOT_FOUND
            )

        resultado = await self.bloqueios_repository.deletar(
            db, bloqueio_id
        )

        if resultado is None:
            raise HTTPException(
                detail='Erro ao deletar o bloqueio',
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR
            )

        return {'message': 'Bloqueio deletado com sucesso.'}

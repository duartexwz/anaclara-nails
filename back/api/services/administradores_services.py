from http import HTTPStatus

from asyncpg import Connection
from fastapi import HTTPException

from api.permissions import is_nail_admin
from api.repositories.administradores_repository import AdministradoresRepository
from api.schemas.administradores_schemas import (
    AdministradorBase,
    AdministradorFilter,
    AdministradorUpdate,
)
from api.schemas.enums import TypeUserEnum
from api.schemas.global_schemas import UsuarioLogado
from api.security import get_password_hash


class AdministradoresServices:
    def __init__(self):
        self.administradores_repository = AdministradoresRepository()


    async def create_administrador(
        self,
        db: Connection,
        current_user: UsuarioLogado,
        administradores: AdministradorBase
    ) -> dict:

        if (
            current_user.type_user_id !=
            TypeUserEnum.ADMIN.value
        ):
            raise HTTPException(
                detail='A ação requer elevação',
                status_code=HTTPStatus.FORBIDDEN
            )

        if (
            administradores.nome and await
            self.administradores_repository.existe(
                db, 'nome', administradores.nome
            )
        ):
            raise HTTPException(
                detail='O nome já pertence a um administrador',
                status_code=HTTPStatus.CONFLICT
            )

        if (
            administradores.email and await
            self.administradores_repository.existe(
                db, 'email', administradores.email
            )
        ):
            raise HTTPException(
                detail='O email já pertence a um administrador',
                status_code=HTTPStatus.CONFLICT
            )

        dados = administradores.model_dump()
        if dados.get('nail_design_id'):
            dados['type_user_id'] = dados.get('type_user_id') or TypeUserEnum.NAIL_ADMIN.value
        elif not dados.get('type_user_id'):
            dados['type_user_id'] = TypeUserEnum.ADMIN.value
        dados['password'] = get_password_hash(dados['password'])

        resultado = await self.administradores_repository.criar(
            db, dados
        )

        if resultado is None:
            raise HTTPException(
                detail='Erro ao criar o administrador',
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR
            )

        return resultado

    async def get_administradores(
        self,
        db: Connection,
        filtrar: AdministradorFilter,
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

        administrador = await self.administradores_repository.buscar(
            db, filtrar
        )

        return administrador

    async def update_administrador(
        self,
        db: Connection,
        administrador_id: int,
        administrador: AdministradorUpdate,
        current_user: UsuarioLogado
    ) -> dict:
        dados = administrador.model_dump(exclude_unset=True)

        # Nail admin (3) só altera a própria senha: não muda tipo, vínculo
        # nem dados de outras contas (evita escalação de privilégio).
        if is_nail_admin(current_user):
            if administrador_id != current_user.id or set(dados) - {'password'}:
                raise HTTPException(
                    detail='A ação requer elevação',
                    status_code=HTTPStatus.FORBIDDEN
                )
        elif current_user.type_user_id != TypeUserEnum.ADMIN.value:
            raise HTTPException(
                detail='A ação requer elevação',
                status_code=HTTPStatus.FORBIDDEN
            )

        atual = await self.administradores_repository.buscar_por_id(
            db, administrador_id
        )

        if not atual:
            raise HTTPException(
                detail='Administrador não encontrado',
                status_code=HTTPStatus.NOT_FOUND
            )

        if dados.get('password'):
            dados['password'] = get_password_hash(dados['password'])

        if not dados:
            raise HTTPException(
                detail='Nenhum campo para atualizar',
                status_code=HTTPStatus.BAD_REQUEST
            )

        resultado = await self.administradores_repository.atualizar(
            db, administrador_id, dados
        )

        if resultado is None:
            raise HTTPException(
                detail='Erro ao atualizar o administrador',
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR
            )

        return resultado

    async def delete_administrador(
        self,
        db: Connection,
        administrador_id: int,
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

        atual = await self.administradores_repository.buscar_por_id(
            db, administrador_id
        )

        if not atual:
            raise HTTPException(
                detail='Administrador não encontrado',
                status_code=HTTPStatus.NOT_FOUND
            )

        resultado = await self.administradores_repository.deletar(
            db, administrador_id
        )

        if resultado is None:
            raise HTTPException(
                detail='Erro ao deletar o administrador',
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR
            )

        return {'message': 'Administrador deletado com sucesso'}

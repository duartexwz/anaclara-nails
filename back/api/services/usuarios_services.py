from http import HTTPStatus

from asyncpg import Connection
from fastapi import HTTPException

from api.repositories.usuarios_repository import UsuarioRepository
from api.schemas.enums import TypeUserEnum
from api.schemas.global_schemas import UsuarioLogado
from api.schemas.usuarios_schemas import UsuarioBase, UsuarioFilter, UsuarioUpdate
from api.security import get_password_hash


# Cria a classe dos serviços de usuários (regras, validações e etc)
class UsuarioServices:
    def __init__(self):
        self.usuario_repository = UsuarioRepository()


    async def create_usuario(
        self, db: Connection,
        usuario: UsuarioBase
    ) -> dict:

        if (
            usuario.email and await
            self.usuario_repository.existe(
                db, 'email', usuario.email
            )
        ):
            raise HTTPException(
                detail='O email já pertence a um usuário',
                status_code=HTTPStatus.CONFLICT
            )

        dados = usuario.model_dump()
        # CADASTRO PÚBLICO SEMPRE CRIA CLIENTE — ADMIN SÓ PELO PAINEL
        dados['type_user_id'] = TypeUserEnum.USER.value
        dados['password'] = get_password_hash(dados['password'])

        resultado  = await self.usuario_repository.criar(
            db, dados
        )

        if resultado is None:
            raise HTTPException(
                detail='Erro ao cadastrar o usuário',
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR
            )

        return resultado


    async def get_usuarios(
        self,
        db: Connection,
        filtrar: UsuarioFilter
    ) -> dict:

        usuarios = await self.usuario_repository.buscar(
            db, filtrar
        )

        if not usuarios:
            raise HTTPException(
                detail='Usuário não encontrado',
                status_code=HTTPStatus.NOT_FOUND
            )

        return usuarios

    async def update_usuarios(
        self,
        db: Connection,
        usuario_id: int,
        usuario: UsuarioUpdate,
        current_user: UsuarioLogado
    ) -> dict:

        atual = await self.usuario_repository.buscar_por_id(
            db, usuario_id
        )

        if not atual:
            raise HTTPException(
                detail='Usuário não encontrado',
                status_code=HTTPStatus.NOT_FOUND
            )

        if (
            usuario.email and await
            self.usuario_repository.existe(
                db, 'email', usuario.email
            )
        ):
            raise HTTPException(
                detail='O email já pertence a um usuário',
                status_code=HTTPStatus.CONFLICT
            )

        dados = usuario.model_dump(exclude_unset=True)

        if not dados:
            raise HTTPException(
                detail='Nenhum campo para atualizar',
                status_code=HTTPStatus.BAD_REQUEST
            )

        # TROCA DE PAPEL SÓ PELO ADMIN (VIA PAINEL)
        if (
            'type_user_id' in dados
            and current_user.type_user_id != TypeUserEnum.ADMIN
        ):
            raise HTTPException(
                detail='Apenas administradores podem alterar o papel',
                status_code=HTTPStatus.FORBIDDEN
            )

        if dados.get('password'):
            dados['password'] = get_password_hash(dados['password'])

        resultado = await self.usuario_repository.atualizar(
            db, usuario_id, dados
        )

        if resultado is None:
            raise HTTPException(
                detail='Erro ao atualizar o usuario',
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR
            )

        return resultado


    async def delete_usuario(
        self,
        db: Connection,
        usuario_id: int,
        current_user: UsuarioLogado
    ) -> dict:

        atual = await self.usuario_repository.buscar_por_id(
            db, usuario_id
        )

        if not atual:
            raise HTTPException(
                detail='Usuário não encontrado',
                status_code=HTTPStatus.NOT_FOUND
            )

        resultado = await self.usuario_repository.deletar(
            db, usuario_id
        )

        if resultado is None:
            raise HTTPException(
                detail='Erro ao deletar o usuário',
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR
            )

        return {'message': 'Usuário deletado com sucesso.'}

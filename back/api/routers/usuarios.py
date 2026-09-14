from http import HTTPStatus
from typing import Annotated

from asyncpg import Connection
from fastapi import APIRouter, Depends

from api.database import get_db
from api.schemas.global_schemas import MessageGlobal, UsuarioLogado
from api.schemas.usuarios_schemas import (
    UsuarioBase,
    UsuarioFilter,
    UsuarioList,
    UsuarioResponse,
    UsuarioUpdate,
)
from api.security import get_current_user
from api.services.usuarios_services import UsuarioServices

usuario_services = UsuarioServices()


T_CurrentUser = Annotated[UsuarioLogado, Depends(get_current_user)]
T_Filter = Annotated[UsuarioFilter, Depends()]
T_Session = Annotated[Connection, Depends(get_db)]


router = APIRouter(
    prefix='/usuarios',
    tags=['usuarios']
)

@router.post(
    '',
    summary='Cadastrar um usuário',
    status_code=HTTPStatus.CREATED,
    response_model=UsuarioResponse
)
async def create_usuario(
    usuario: UsuarioBase,
    db: T_Session,
):
    return await usuario_services.create_usuario(
        db=db, usuario=usuario
    )

@router.get(
    '',
    summary='Listar usuários',
    status_code=HTTPStatus.OK,
    response_model=UsuarioList
)

async def get_usuarios(
    filtrar: T_Filter,
    db: T_Session,
):
    resultado = await usuario_services.get_usuarios(
        db=db, filtrar=filtrar
    )
    return {'usuarios': resultado}


@router.patch(
    '/{usuario_id}',
    summary='Atualizar os dados do usuário',
    status_code=HTTPStatus.OK,
    response_model=UsuarioResponse
)

async def update_usuarios(
    db: T_Session,
    usuario_id: int,
    usuario: UsuarioUpdate,
    current_user: T_CurrentUser
):
    return await usuario_services.update_usuarios(
        db=db, usuario_id=usuario_id,
        usuario=usuario, current_user=current_user
    )

@router.delete(
    '/{usuario_id}',
    summary='Deletar um usuário',
    status_code=HTTPStatus.OK,
    response_model=MessageGlobal
)

async def delete_usuario(
    db: T_Session,
    usuario_id: int,
    current_user: T_CurrentUser
):
    return await usuario_services.delete_usuario(
        db=db, usuario_id=usuario_id,
        current_user=current_user
    )

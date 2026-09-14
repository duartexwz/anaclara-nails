from http import HTTPStatus
from typing import Annotated

from asyncpg import Connection
from fastapi import APIRouter, Depends

from api.database import get_db
from api.schemas.global_schemas import MessageGlobal, UsuarioLogado
from api.schemas.modelos_unhas_schemas import (
    ModeloUnhaBase,
    ModeloUnhaFilter,
    ModeloUnhaList,
    ModeloUnhaResponse,
    ModeloUnhaUpdate,
)
from api.security import get_current_user
from api.services.modelos_unhas_services import ModelosUnhasServices

modelos_unhas_services = ModelosUnhasServices()


T_CurrentUser = Annotated[UsuarioLogado, Depends(get_current_user)]
T_Filter = Annotated[ModeloUnhaFilter, Depends()]
T_Session = Annotated[Connection, Depends(get_db)]


router = APIRouter(
    prefix='/modelos-unhas',
    tags=['modelos-unhas']
)

@router.post(
    '',
    summary='Cadastrar um modelo de unha',
    status_code=HTTPStatus.CREATED,
    response_model=ModeloUnhaResponse
)
async def create_modelo_unha(
    modelo_unha: ModeloUnhaBase,
    db: T_Session,
    current_user: T_CurrentUser
):
    return await modelos_unhas_services.create_modelo_unha(
        db=db, modelo_unha=modelo_unha,
        current_user=current_user
    )

@router.get(
    '',
    summary='Listar modelos de unhas',
    status_code=HTTPStatus.OK,
    response_model=ModeloUnhaList
)

async def get_modelos_unhas(
    filtrar: T_Filter,
    db: T_Session,
):
    resultado = await modelos_unhas_services.get_modelos_unhas(
        db=db, filtrar=filtrar
    )
    return {'modelos_unhas': resultado}


@router.patch(
    '/{modelo_unha_id}',
    summary='Atualizar os dados do modelo de unha',
    status_code=HTTPStatus.OK,
    response_model=ModeloUnhaResponse
)

async def update_modelo_unha(
    db: T_Session,
    modelo_unha_id: int,
    modelo_unha: ModeloUnhaUpdate,
    current_user: T_CurrentUser
):
    return await modelos_unhas_services.update_modelo_unha(
        db=db, modelo_unha_id=modelo_unha_id,
        modelo_unha=modelo_unha, current_user=current_user
    )

@router.delete(
    '/{modelo_unha_id}',
    summary='Deletar um modelo de unha',
    status_code=HTTPStatus.OK,
    response_model=MessageGlobal
)

async def delete_modelo_unha(
    db: T_Session,
    modelo_unha_id: int,
    current_user: T_CurrentUser
):
    return await modelos_unhas_services.delete_modelo_unha(
        db=db, modelo_unha_id=modelo_unha_id,
        current_user=current_user
    )

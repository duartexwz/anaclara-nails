from http import HTTPStatus
from typing import Annotated

from asyncpg import Connection
from fastapi import APIRouter, Depends

from api.database import get_db
from api.schemas.bloqueios_schemas import (
    BloqueioBase,
    BloqueioFilter,
    BloqueioList,
    BloqueioResponse,
)
from api.schemas.global_schemas import MessageGlobal, UsuarioLogado
from api.security import get_current_user
from api.services.bloqueios_services import BloqueiosServices

bloqueios_services = BloqueiosServices()


T_CurrentUser = Annotated[UsuarioLogado, Depends(get_current_user)]
T_Filter = Annotated[BloqueioFilter, Depends()]
T_Session = Annotated[Connection, Depends(get_db)]


router = APIRouter(
    prefix='/bloqueios',
    tags=['bloqueios']
)

@router.post(
    '/',
    summary='Bloquear uma data na agenda',
    status_code=HTTPStatus.CREATED,
    response_model=BloqueioResponse
)
async def create_bloqueio(
    bloqueio: BloqueioBase,
    db: T_Session,
    current_user: T_CurrentUser
):
    return await bloqueios_services.create_bloqueio(
        db=db, bloqueio=bloqueio,
        current_user=current_user
    )

@router.get(
    '/',
    summary='Listar bloqueios da agenda',
    status_code=HTTPStatus.OK,
    response_model=BloqueioList
)

async def get_bloqueios(
    filtrar: T_Filter,
    db: T_Session,
    current_user: T_CurrentUser
):
    resultado = await bloqueios_services.get_bloqueios(
        db=db, filtrar=filtrar,
        current_user=current_user
    )
    return {'bloqueios': resultado}

@router.delete(
    '/{bloqueio_id}',
    summary='Liberar uma data bloqueada',
    status_code=HTTPStatus.OK,
    response_model=MessageGlobal
)

async def delete_bloqueio(
    db: T_Session,
    bloqueio_id: int,
    current_user: T_CurrentUser
):
    return await bloqueios_services.delete_bloqueio(
        db=db, bloqueio_id=bloqueio_id,
        current_user=current_user
    )

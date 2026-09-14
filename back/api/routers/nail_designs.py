from http import HTTPStatus
from typing import Annotated

from asyncpg import Connection
from fastapi import APIRouter, Depends

from api.database import get_db
from api.schemas.global_schemas import MessageGlobal, UsuarioLogado
from api.schemas.nails_designs_schemas import (
    NailDesignBase,
    NailDesignFilter,
    NailDesignList,
    NailDesignResponse,
    NailDesignUpdate,
)
from api.security import get_current_user
from api.services.nail_designs_services import NailDesignsServices

nail_designs_services = NailDesignsServices()


T_CurrentUser = Annotated[UsuarioLogado, Depends(get_current_user)]
T_Filter = Annotated[NailDesignFilter, Depends()]
T_Session = Annotated[Connection, Depends(get_db)]


router = APIRouter(
    prefix='/nail-designs',
    tags=['nail-designs']
)

@router.post(
    '',
    summary='Cadastrar uma profissional',
    status_code=HTTPStatus.CREATED,
    response_model=NailDesignResponse
)
async def create_nail_design(
    nail_design: NailDesignBase,
    db: T_Session,
    current_user: T_CurrentUser
):
    return await nail_designs_services.create_nail_design(
        db=db, nail_design=nail_design,
        current_user=current_user
    )

@router.get(
    '',
    summary='Listar profissionais',
    status_code=HTTPStatus.OK,
    response_model=NailDesignList
)

async def get_nail_designs(
    filtrar: T_Filter,
    db: T_Session,
    current_user: T_CurrentUser
):
    resultado = await nail_designs_services.get_nail_designs(
        db=db, filtrar=filtrar,
        current_user=current_user
    )
    return {'nails_designs': resultado}


@router.patch(
    '/{nail_design_id}',
    summary='Atualizar os dados da profissional',
    status_code=HTTPStatus.OK,
    response_model=NailDesignResponse
)

async def update_nail_design(
    db: T_Session,
    nail_design_id: int,
    nail_design: NailDesignUpdate,
    current_user: T_CurrentUser
):
    return await nail_designs_services.update_nail_design(
        db=db, nail_design_id=nail_design_id,
        nail_design=nail_design, current_user=current_user
    )

@router.delete(
    '/{nail_design_id}',
    summary='Deletar uma profissional',
    status_code=HTTPStatus.OK,
    response_model=MessageGlobal
)

async def delete_nail_design(
    db: T_Session,
    nail_design_id: int,
    current_user: T_CurrentUser
):
    return await nail_designs_services.delete_nail_design(
        db=db, nail_design_id=nail_design_id,
        current_user=current_user
    )

from http import HTTPStatus
from typing import Annotated

from asyncpg import Connection
from fastapi import APIRouter, Depends, UploadFile

from api.database import get_db
from api.schemas.global_schemas import MessageGlobal, UsuarioLogado
from api.schemas.uploads_schemas import UploadResponse
from api.security import get_current_user
from api.services.uploads_service import UploadsServices

uploads_services = UploadsServices()


T_CurrentUser = Annotated[UsuarioLogado, Depends(get_current_user)]
T_Session = Annotated[Connection, Depends(get_db)]


router = APIRouter(
    prefix='/uploads',
    tags=['uploads']
)

@router.post(
    '/modelos/{modelo_id}',
    summary='Enviar foto do modelo (Cloudflare R2)',
    status_code=HTTPStatus.CREATED,
    response_model=UploadResponse
)
async def upload_foto_modelo(
    modelo_id: int,
    arquivo: UploadFile,
    db: T_Session,
    current_user: T_CurrentUser
):
    return await uploads_services.upload_foto_modelo(
        db=db, modelo_id=modelo_id,
        arquivo=arquivo, current_user=current_user
    )

@router.delete(
    '/modelos/{modelo_id}',
    summary='Remover foto do modelo (Cloudflare R2)',
    status_code=HTTPStatus.OK,
    response_model=MessageGlobal
)
async def remover_foto_modelo(
    db: T_Session,
    modelo_id: int,
    current_user: T_CurrentUser
):
    return await uploads_services.remover_foto_modelo(
        db=db, modelo_id=modelo_id,
        current_user=current_user
    )

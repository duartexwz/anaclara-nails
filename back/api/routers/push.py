from http import HTTPStatus
from typing import Annotated

from asyncpg import Connection
from fastapi import APIRouter, Depends, HTTPException, Query

from api.database import get_db
from api.repositories.push_subscriptions_repository import (
    PushSubscriptionsRepository,
)
from api.schemas.global_schemas import MessageGlobal, UsuarioLogado
from api.schemas.push_schemas import (
    PushSubscriptionBase,
    PushSubscriptionFilter,
    PushSubscriptionList,
    PushSubscriptionResponse,
    VapidKeyResponse,
)
from api.security import get_current_user
from api.services.push_service import push_configurado
from api.settings import settings

push_repository = PushSubscriptionsRepository()


T_CurrentUser = Annotated[UsuarioLogado, Depends(get_current_user)]
T_Session = Annotated[Connection, Depends(get_db)]


router = APIRouter(
    prefix='/push',
    tags=['push']
)

@router.get(
    '/vapid-key',
    summary='Chave pública VAPID para inscrever o dispositivo',
    status_code=HTTPStatus.OK,
    response_model=VapidKeyResponse
)
async def get_vapid_key():
    return {'public_key': settings.VAPID_PUBLIC_KEY}

@router.get(
    '/subscriptions',
    summary='Listar dispositivos inscritos',
    status_code=HTTPStatus.OK,
    response_model=PushSubscriptionList
)

async def get_subscriptions(
    db: T_Session,
    current_user: T_CurrentUser
):
    resultado = await push_repository.buscar(
        db, PushSubscriptionFilter()
    )
    return {'subscriptions': resultado}

@router.post(
    '/subscriptions',
    summary='Inscrever dispositivo logado no push',
    status_code=HTTPStatus.CREATED,
    response_model=PushSubscriptionResponse
)
async def create_subscription(
    subscription: PushSubscriptionBase,
    db: T_Session,
    current_user: T_CurrentUser
):
    if not push_configurado():
        raise HTTPException(
            detail='Push não configurado no servidor',
            status_code=HTTPStatus.SERVICE_UNAVAILABLE
        )

    existente = await push_repository.buscar(
        db, PushSubscriptionFilter(endpoint=subscription.endpoint)
    )
    if existente:
        return existente[0]

    resultado = await push_repository.criar(
        db, subscription.model_dump()
    )

    if resultado is None:
        raise HTTPException(
            detail='Erro ao salvar a inscrição',
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR
        )

    return resultado

@router.delete(
    '/subscriptions',
    summary='Remover inscrição do dispositivo',
    status_code=HTTPStatus.OK,
    response_model=MessageGlobal
)

async def delete_subscription(
    db: T_Session,
    current_user: T_CurrentUser,
    endpoint: Annotated[str, Query()] = ''
):
    if not endpoint:
        raise HTTPException(
            detail='Informe o endpoint da inscrição',
            status_code=HTTPStatus.BAD_REQUEST
        )

    existentes = await push_repository.buscar(
        db, PushSubscriptionFilter(endpoint=endpoint)
    )

    for item in existentes:
        await push_repository.deletar(db, item['id'])

    return {'message': 'Inscrição removida com sucesso.'}

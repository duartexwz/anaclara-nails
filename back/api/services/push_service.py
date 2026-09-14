import asyncio
import json

from asyncpg import Connection
from pywebpush import WebPushException, webpush

from api.repositories.push_subscriptions_repository import (
    PushSubscriptionsRepository,
)
from api.schemas.push_schemas import PushSubscriptionFilter
from api.settings import settings


def push_configurado() -> bool:
    return bool(
        settings.VAPID_PUBLIC_KEY
        and settings.VAPID_PRIVATE_KEY
        and settings.VAPID_SUBJECT
    )


def _enviar_para_inscricao(subscription: dict, titulo: str, corpo: str,
                           agendamento_id: int | None) -> str:
    ## RETORNA 'ok' | 'remover' (ENDPOINT MORTO - 404/410) | 'falha'
    try:
        webpush(
            subscription_info={
                'endpoint': subscription['endpoint'],
                'keys': {
                    'p256dh': subscription['p256dh'],
                    'auth': subscription['auth'],
                },
            },
            data=json.dumps({
                'title': titulo,
                'body': corpo,
                'agendamento_id': agendamento_id,
            }),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={'sub': settings.VAPID_SUBJECT},
        )
        return 'ok'
    except WebPushException as exc:
        status = getattr(exc.response, 'status_code', None)
        if status in (404, 410):
            return 'remover'
        return 'falha'
    except Exception:
        return 'falha'


async def enviar_push_admins(
    db: Connection,
    titulo: str,
    corpo: str,
    agendamento_id: int | None = None,
) -> dict:
    ## DISPARA PUSH A TODOS OS DISPOSITIVOS LOGADOS; REMOVE INSCRITOS MORTOS
    if not push_configurado():
        return {'enviados': 0, 'removidos': 0}

    repo = PushSubscriptionsRepository()
    inscricoes = await repo.buscar(db, PushSubscriptionFilter())

    enviados = 0
    removidos = 0
    for sub in inscricoes:
        resultado = await asyncio.to_thread(
            _enviar_para_inscricao, sub, titulo, corpo, agendamento_id
        )
        if resultado == 'ok':
            enviados += 1
        elif resultado == 'remover':
            await repo.deletar(db, sub['id'])
            removidos += 1

    return {'enviados': enviados, 'removidos': removidos}

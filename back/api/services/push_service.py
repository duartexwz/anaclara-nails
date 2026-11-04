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


async def _ids_admin(db: Connection) -> set:
    from api.repositories.usuarios_repository import UsuarioRepository
    from api.schemas.enums import TypeUserEnum
    from api.schemas.usuarios_schemas import UsuarioFilter

    admins = await UsuarioRepository().buscar(
        db, UsuarioFilter(type_user_id=TypeUserEnum.ADMIN.value, limit=500)
    )
    return {u['id'] for u in admins}


async def _disparar(
    db: Connection,
    inscricoes: list,
    titulo: str,
    corpo: str,
    agendamento_id: int | None,
) -> dict:
    repo = PushSubscriptionsRepository()
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


async def enviar_push_admins(
    db: Connection,
    titulo: str,
    corpo: str,
    agendamento_id: int | None = None,
) -> dict:
    ## SÓ AOS APARELHOS DE ADMIN: antes ia a TODOS os inscritos, e a
    ## cliente recebia no próprio aparelho o push "Nova mensagem de
    ## cliente" ao enviar mensagem. Inscrições legadas sem dono recebem nada.
    if not push_configurado():
        return {'enviados': 0, 'removidos': 0}

    repo = PushSubscriptionsRepository()
    inscricoes = await repo.buscar(db, PushSubscriptionFilter())
    admins = await _ids_admin(db)
    alvos = [s for s in inscricoes if s.get('usuario_id') in admins]
    return await _disparar(db, alvos, titulo, corpo, agendamento_id)


async def enviar_push_usuario(
    db: Connection,
    usuario_id: int,
    titulo: str,
    corpo: str,
    agendamento_id: int | None = None,
) -> dict:
    ## RESPOSTA DA ADMIN: só aos aparelhos da sessão do cliente (é o que
    ## faz o "Receber respostas neste aparelho" funcionar de verdade).
    if not push_configurado():
        return {'enviados': 0, 'removidos': 0}

    repo = PushSubscriptionsRepository()
    inscricoes = await repo.buscar(
        db, PushSubscriptionFilter(usuario_id=usuario_id)
    )
    return await _disparar(db, inscricoes, titulo, corpo, agendamento_id)

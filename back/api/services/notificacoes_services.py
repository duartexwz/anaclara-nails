from http import HTTPStatus

from asyncpg import Connection
from fastapi import HTTPException

from api.repositories.notificacoes_repository import NotificacoesRepository
from api.repositories.push_subscriptions_repository import (
    PushSubscriptionsRepository,
)
from api.schemas.enums import TypeUserEnum
from api.schemas.global_schemas import UsuarioLogado
from api.schemas.notificacoes_schemas import NotificacaoFilter


# Cria a classe dos serviços de notificações (regras, validações e etc)
class NotificacoesServices:
    def __init__(self):
        self.notificacoes_repository = NotificacoesRepository()
        self.push_repository = PushSubscriptionsRepository()

    def _exigir_admin(self, current_user: UsuarioLogado) -> None:
        if (
            current_user.type_user_id !=
            TypeUserEnum.ADMIN
        ):
            raise HTTPException(
                detail='A ação requer elevação',
                status_code=HTTPStatus.FORBIDDEN
            )

    async def registrar(
        self,
        db: Connection,
        tipo: str,
        titulo: str,
        mensagem: str,
        agendamento_id: int | None = None,
    ) -> dict | None:
        ## GRAVA O EVENTO NO MURAL (FALHA AQUI NÃO PODE QUEBRAR O FLUXO)
        try:
            return await self.notificacoes_repository.criar(
                db,
                {
                    'tipo': tipo,
                    'titulo': titulo,
                    'mensagem': mensagem,
                    'agendamento_id': agendamento_id,
                },
            )
        except Exception:
            return None

    async def get_notificacoes(
        self,
        db: Connection,
        filtrar: NotificacaoFilter,
        current_user: UsuarioLogado
    ) -> dict:
        self._exigir_admin(current_user)

        notificacoes = await self.notificacoes_repository.buscar(
            db, filtrar
        )

        if not notificacoes:
            raise HTTPException(
                detail='Nenhuma notificação encontrada',
                status_code=HTTPStatus.NOT_FOUND
            )

        return notificacoes

    async def marcar_lida(
        self,
        db: Connection,
        notificacao_id: int,
        current_user: UsuarioLogado
    ) -> dict:
        self._exigir_admin(current_user)

        atual = await self.notificacoes_repository.buscar_por_id(
            db, notificacao_id
        )

        if not atual:
            raise HTTPException(
                detail='Notificação não encontrada',
                status_code=HTTPStatus.NOT_FOUND
            )

        resultado = await self.notificacoes_repository.atualizar(
            db, notificacao_id, {'lida': True}
        )

        if resultado is None:
            raise HTTPException(
                detail='Erro ao atualizar a notificação',
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR
            )

        return resultado

    async def marcar_todas_lidas(
        self,
        db: Connection,
        current_user: UsuarioLogado
    ) -> dict:
        self._exigir_admin(current_user)

        pendentes = await self.notificacoes_repository.buscar(
            db, NotificacaoFilter(lida=False, limit=500)
        )

        for item in pendentes:
            await self.notificacoes_repository.atualizar(
                db, item['id'], {'lida': True}
            )

        return {'message': 'Todas as notificações foram marcadas como lidas.'}


async def disparar_notificacao_admin(
    db: Connection,
    tipo: str,
    titulo: str,
    mensagem: str,
    agendamento_id: int | None = None,
) -> None:
    ## ATALHO DOS EVENTOS (AGENDAMENTO/CANCELAMENTO/PAGAMENTO/MENSAGEM):
    ## GRAVA NO MURAL E EMPURRA PUSH AOS DISPOSITIVOS, SEM DERRUBAR
    ## O FLUXO PRINCIPAL EM CASO DE FALHA.
    from contextlib import suppress

    from api.services.push_service import enviar_push_admins

    svc = NotificacoesServices()
    await svc.registrar(db, tipo, titulo, mensagem, agendamento_id)
    with suppress(Exception):
        await enviar_push_admins(db, titulo, mensagem, agendamento_id)

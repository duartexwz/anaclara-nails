from http import HTTPStatus

from asyncpg import Connection
from fastapi import HTTPException

from api.repositories.agendamentos_repository import AgendamentosRepository
from api.repositories.mensagens_repository import MensagensRepository
from api.schemas.global_schemas import UsuarioLogado
from api.schemas.mensagens_schemas import (
    MensagemBase,
    MensagemFilter,
    MensagemUpdate,
)


# Cria a classe dos serviços de mensagens (regras, validações e etc)
class MensagensServices:
    def __init__(self):
        self.mensagens_repository = MensagensRepository()
        self.agendamentos_repository = AgendamentosRepository()


    async def create_mensagem(
        self,
        db: Connection,
        mensagem: MensagemBase,
        current_user: UsuarioLogado
    ) -> dict:

        if mensagem.remetente not in ('admin', 'cliente'):
            raise HTTPException(
                detail='Remetente inválido',
                status_code=HTTPStatus.BAD_REQUEST
            )

        if mensagem.agendamento_id is not None:
            agendamento = await self.agendamentos_repository.buscar_por_id(
                db, mensagem.agendamento_id
            )
            if not agendamento:
                raise HTTPException(
                    detail='Agendamento não encontrado',
                    status_code=HTTPStatus.NOT_FOUND
                )

        if not mensagem.texto.strip():
            raise HTTPException(
                detail='Mensagem vazia',
                status_code=HTTPStatus.BAD_REQUEST
            )

        dados = mensagem.model_dump()

        resultado = await self.mensagens_repository.criar(
            db, dados
        )

        if resultado is None:
            raise HTTPException(
                detail='Erro ao enviar a mensagem',
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR
            )

        # MURAL + PUSH (cliente -> admin recebe na hora; admin -> cliente
        # recebe no aparelho). Falha aqui nunca derruba o envio.
        from api.services.notificacoes_services import (
            disparar_notificacao_admin,
        )

        texto = (mensagem.texto or '').strip()
        previa = texto[:120] + ('…' if len(texto) > 120 else '')
        if mensagem.remetente == 'cliente':
            titulo = 'Nova mensagem de cliente'
        else:
            titulo = 'Nova mensagem da Ana Clara'
        await disparar_notificacao_admin(
            db, 'mensagem', titulo, previa, mensagem.agendamento_id
        )

        return resultado


    async def get_mensagens(
        self,
        db: Connection,
        filtrar: MensagemFilter,
        current_user: UsuarioLogado
    ) -> dict:

        mensagens = await self.mensagens_repository.buscar(
            db, filtrar
        )

        return mensagens


    async def update_mensagem(
        self,
        db: Connection,
        mensagem_id: int,
        mensagem: MensagemUpdate,
        current_user: UsuarioLogado
    ) -> dict:

        atual = await self.mensagens_repository.buscar_por_id(
            db, mensagem_id
        )

        if not atual:
            raise HTTPException(
                detail='Mensagem não encontrada',
                status_code=HTTPStatus.NOT_FOUND
            )

        dados = mensagem.model_dump(exclude_unset=True)

        if not dados:
            raise HTTPException(
                detail='Nenhum campo para atualizar',
                status_code=HTTPStatus.BAD_REQUEST
            )

        resultado = await self.mensagens_repository.atualizar(
            db, mensagem_id, dados
        )

        if resultado is None:
            raise HTTPException(
                detail='Erro ao atualizar a mensagem',
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR
            )

        return resultado

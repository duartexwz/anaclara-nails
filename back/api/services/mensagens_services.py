from http import HTTPStatus

from asyncpg import Connection
from fastapi import HTTPException

from api.repositories.agendamentos_repository import AgendamentosRepository
from api.repositories.mensagens_repository import MensagensRepository
from api.schemas.enums import TypeUserEnum
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


    async def _cliente_id_do_usuario(
        self, db: Connection, user_id: int
    ) -> int | None:
        from api.repositories.clientes_repository import ClientesRepository
        from api.schemas.clientes_schemas import ClienteFilter

        encontrados = await ClientesRepository().buscar(
            db, ClienteFilter(email_id=user_id)
        )
        return encontrados[0]['id'] if encontrados else None

    async def _garantir_cliente_do_usuario(
        self, db: Connection, current_user: UsuarioLogado
    ) -> int | None:
        # Garante conversa privada por sessão: se o login ainda não tem
        # cadastro em clientes (ex.: nunca agendou), cria o vínculo mínimo.
        # Sem isso a mensagem caía em "Sem vínculo" e a resposta da admin
        # nunca chegava à conversa da cliente.
        # Falha aqui nunca derruba o envio (usuario_id já identifica a sessão).
        from api.repositories.clientes_repository import ClientesRepository
        from api.schemas.clientes_schemas import ClienteFilter

        try:
            encontrados = await ClientesRepository().buscar(
                db, ClienteFilter(email_id=current_user.id)
            )
            if encontrados:
                return encontrados[0]['id']
            novo = await ClientesRepository().criar(
                db,
                {
                    'nome': current_user.nome,
                    'telefone': None,
                    'email_id': current_user.id,
                },
            )
            return (novo or {}).get('id')
        except Exception:
            return None

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

        agendamento = None
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

        # VINCULA A CONVERSA À CLIENTE (painel admin) E AO USUÁRIO
        # (conversa privada por sessão: cada login vê só a sua).
        # Sem isso, mensagens sem agendamento_id ficavam órfãs e o
        # painel por cliente nunca as via.
        from api.repositories.clientes_repository import ClientesRepository

        cliente_id = mensagem.cliente_id
        if cliente_id is None and agendamento is not None:
            cliente_id = agendamento.get('cliente_id')
        if cliente_id is None and mensagem.remetente == 'cliente':
            cliente_id = await self._garantir_cliente_do_usuario(
                db, current_user
            )

        # Dono da conversa: quem enviou (cliente) ou o destinatário
        # (admin -> usuário da cliente vinculada).
        usuario_id: int | None = None
        if mensagem.remetente == 'cliente':
            usuario_id = current_user.id
        elif cliente_id is not None:
            cliente = await ClientesRepository().buscar_por_id(
                db, cliente_id
            )
            usuario_id = (cliente or {}).get('email_id')

        dados = mensagem.model_dump()
        dados['cliente_id'] = cliente_id
        dados['usuario_id'] = usuario_id

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

        # ESCOPO POR PERFIL: admin vê tudo (painel por cliente);
        # cada sessão comum vê só a própria conversa privada com a
        # admin (antes vazava tudo; e sem cadastro o usuário ao menos
        # vê o que ele mesmo enviou, pois usuario_id nunca é nulo).
        if current_user.type_user_id != TypeUserEnum.ADMIN.value:
            filtrar.usuario_id = current_user.id

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

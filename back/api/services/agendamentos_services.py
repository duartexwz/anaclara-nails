from http import HTTPStatus

from asyncpg import Connection
from fastapi import HTTPException

from api.repositories.agendamentos_repository import AgendamentosRepository
from api.repositories.modelos_unhas_repository import ModelosUnhasRepository
from api.schemas.agendamentos_schemas import (
    AgenamentoBase,
    AgendamentoFilter,
    AgendamentoUpdate,
)
from api.schemas.enums import StatusPagamentoEnum, TypeUserEnum
from api.schemas.global_schemas import UsuarioLogado


# Cria a classe dos serviços de agendamentos (regras, validações e etc)
class AgendamentosServices:
    def __init__(self):
        self.agendamentos_repository = AgendamentosRepository()
        self.modelos_unhas_repository = ModelosUnhasRepository()


    async def create_agendamento(
        self, db: Connection,
        agendamento: AgenamentoBase
    ) -> dict:

        modelo = await self.modelos_unhas_repository.buscar_por_id(
            db, agendamento.modelo_id
        )

        if not modelo:
            raise HTTPException(
                detail='Modelo de unha não encontrado',
                status_code=HTTPStatus.NOT_FOUND
            )

        # RN01 - o sinal corresponde a 50% do valor total do serviço
        sinal_esperado = round(float(modelo['valor_total']) / 2, 2)

        if abs(float(agendamento.sinal) - sinal_esperado) > 0.01:
            raise HTTPException(
                detail='O sinal deve corresponder a 50% do valor do serviço',
                status_code=HTTPStatus.UNPROCESSABLE_ENTITY
            )

        # RN06 - não é possível agendar em horário já reservado
        if await self.agendamentos_repository.existe_conflito(
            db, {'horario': agendamento.horario}
        ):
            raise HTTPException(
                detail='Horário já reservado por outro cliente',
                status_code=HTTPStatus.CONFLICT
            )

        dados = agendamento.model_dump()

        # RN03 - agendamento nasce pendente até a aprovação do sinal
        if dados.get('status_pagamentos_id') is None:
            dados['status_pagamentos_id'] = (
                await self.agendamentos_repository.buscar_status_id(
                    db, StatusPagamentoEnum.PENDENTE
                )
            )

        resultado = await self.agendamentos_repository.criar(
            db, dados
        )

        if resultado is None:
            raise HTTPException(
                detail='Erro ao cadastrar o agendamento',
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR
            )

        from api.services.notificacoes_services import (
            disparar_notificacao_admin,
        )
        await disparar_notificacao_admin(
            db,
            'agendamento',
            'Novo agendamento recebido',
            f"Agendamento #{resultado.get('id')} criado e aguardando o sinal.",
            resultado.get('id'),
        )

        return resultado


    async def get_agendamentos(
        self,
        db: Connection,
        filtrar: AgendamentoFilter,
        current_user: UsuarioLogado
    ) -> dict:

        agendamentos = await self.agendamentos_repository.buscar(
            db, filtrar
        )

        if not agendamentos:
            raise HTTPException(
                detail='Agendamento não encontrado',
                status_code=HTTPStatus.NOT_FOUND
            )

        return agendamentos


    async def update_agendamento(
        self,
        db: Connection,
        agendamento_id: int,
        agendamento: AgendamentoUpdate,
        current_user: UsuarioLogado
    ) -> dict:

        if (
            current_user.type_user_id !=
            TypeUserEnum.ADMIN
        ):
            raise HTTPException(
                detail='A ação requer elevação',
                status_code=HTTPStatus.FORBIDDEN
            )

        atual = await self.agendamentos_repository.buscar_por_id(
            db, agendamento_id
        )

        if not atual:
            raise HTTPException(
                detail='Agendamento não encontrado',
                status_code=HTTPStatus.NOT_FOUND
            )

        dados = agendamento.model_dump(exclude_unset=True)

        if not dados:
            raise HTTPException(
                detail='Nenhum campo para atualizar',
                status_code=HTTPStatus.BAD_REQUEST
            )

        # RN06 - a remarcação também não pode colidir com outro horário
        if 'horario' in dados and await (
            self.agendamentos_repository.existe_conflito(
                db, {'horario': dados['horario']},
                excluir_id=agendamento_id
            )
        ):
            raise HTTPException(
                detail='Horário já reservado por outro cliente',
                status_code=HTTPStatus.CONFLICT
            )

        # RN01 - troca de modelo ou de sinal precisa manter os 50%
        modelo_id = dados.get('modelo_id', atual['modelo_id'])
        sinal = float(dados.get('sinal', atual['sinal']))

        if 'modelo_id' in dados or 'sinal' in dados:
            modelo = await self.modelos_unhas_repository.buscar_por_id(
                db, modelo_id
            )

            if not modelo:
                raise HTTPException(
                    detail='Modelo de unha não encontrado',
                    status_code=HTTPStatus.NOT_FOUND
                )

            sinal_esperado = round(float(modelo['valor_total']) / 2, 2)

            if abs(sinal - sinal_esperado) > 0.01:
                raise HTTPException(
                    detail='O sinal deve corresponder a 50% do valor do serviço',
                    status_code=HTTPStatus.UNPROCESSABLE_ENTITY
                )

        resultado = await self.agendamentos_repository.atualizar(
            db, agendamento_id, dados
        )

        if resultado is None:
            raise HTTPException(
                detail='Erro ao atualizar o agendamento',
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR
            )

        return resultado


    async def delete_agendamento(
        self,
        db: Connection,
        agendamento_id: int,
        current_user: UsuarioLogado
    ) -> dict:

        atual = await self.agendamentos_repository.buscar_por_id(
            db, agendamento_id
        )

        if not atual:
            raise HTTPException(
                detail='Agendamento não encontrado',
                status_code=HTTPStatus.NOT_FOUND
            )

        # RF17 — cancela a admin ou a dona do agendamento (via email_id)
        if current_user.type_user_id != TypeUserEnum.ADMIN:
            from api.repositories.clientes_repository import (
                ClientesRepository,
            )
            cliente = await ClientesRepository().buscar_por_id(
                db, atual['cliente_id']
            )
            if not cliente or cliente.get('email_id') != current_user.id:
                raise HTTPException(
                    detail='A ação requer elevação',
                    status_code=HTTPStatus.FORBIDDEN
                )

        resultado = await self.agendamentos_repository.deletar(
            db, agendamento_id
        )

        if resultado is None:
            raise HTTPException(
                detail='Erro ao deletar o agendamento',
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR
            )

        from api.services.notificacoes_services import (
            disparar_notificacao_admin,
        )
        await disparar_notificacao_admin(
            db,
            'cancelamento',
            'Agendamento cancelado',
            f'Agendamento #{agendamento_id} foi cancelado.',
            agendamento_id,
        )

        return {'message': 'Agendamento deletado com sucesso.'}

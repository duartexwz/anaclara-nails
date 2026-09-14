from http import HTTPStatus

from asyncpg import Connection
from fastapi import HTTPException

from api.repositories.programacao_semanal_repository import (
    ProgramacaoSemanalRepository,
)
from api.schemas.enums import TypeUserEnum
from api.schemas.global_schemas import UsuarioLogado
from api.schemas.programacao_semanal_schemas import (
    ProgramacaoSemanalBase,
    ProgramacaoSemanalFilter,
    ProgramacaoSemanalUpdate,
)


# Cria a classe dos serviços de programação semanal (regras, validações e etc)
class ProgramacaoSemanalServices:
    def __init__(self):
        self.programacao_semanal_repository = ProgramacaoSemanalRepository()


    async def create_programacao_semanal(
        self,
        db: Connection,
        programacao_semanal: ProgramacaoSemanalBase,
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

        if await self.programacao_semanal_repository.existe_conflito(
            db, {
                'profissional_id': programacao_semanal.profissional_id,
                'dia_semana': programacao_semanal.dia_semana
            }
        ):
            raise HTTPException(
                detail='Dia já configurado para esta profissional',
                status_code=HTTPStatus.CONFLICT
            )

        dados = programacao_semanal.model_dump()

        resultado = await self.programacao_semanal_repository.criar(
            db, dados
        )

        if resultado is None:
            raise HTTPException(
                detail='Erro ao cadastrar a programação semanal',
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR
            )

        return resultado


    async def get_programacao_semanal(
        self,
        db: Connection,
        filtrar: ProgramacaoSemanalFilter
    ) -> dict:

        programacao_semanal = (
            await self.programacao_semanal_repository.buscar(
                db, filtrar
            )
        )

        if not programacao_semanal:
            raise HTTPException(
                detail='Programação semanal não encontrada',
                status_code=HTTPStatus.NOT_FOUND
            )

        return programacao_semanal


    async def update_programacao_semanal(
        self,
        db: Connection,
        programacao_semanal_id: int,
        programacao_semanal: ProgramacaoSemanalUpdate,
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

        atual = await self.programacao_semanal_repository.buscar_por_id(
            db, programacao_semanal_id
        )

        if not atual:
            raise HTTPException(
                detail='Programação semanal não encontrada',
                status_code=HTTPStatus.NOT_FOUND
            )

        dados = programacao_semanal.model_dump(exclude_unset=True)

        if not dados:
            raise HTTPException(
                detail='Nenhum campo para atualizar',
                status_code=HTTPStatus.BAD_REQUEST
            )

        profissional_id = dados.get(
            'profissional_id', atual.get('profissional_id')
        )
        dia_semana = dados.get('dia_semana', atual.get('dia_semana'))

        if (
            'profissional_id' in dados or 'dia_semana' in dados
        ) and await self.programacao_semanal_repository.existe_conflito(
            db, {
                'profissional_id': profissional_id,
                'dia_semana': dia_semana
            },
            excluir_id=programacao_semanal_id
        ):
            raise HTTPException(
                detail='Dia já configurado para esta profissional',
                status_code=HTTPStatus.CONFLICT
            )

        resultado = await self.programacao_semanal_repository.atualizar(
            db, programacao_semanal_id, dados
        )

        if resultado is None:
            raise HTTPException(
                detail='Erro ao atualizar a programação semanal',
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR
            )

        return resultado


    async def delete_programacao_semanal(
        self,
        db: Connection,
        programacao_semanal_id: int,
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

        atual = await self.programacao_semanal_repository.buscar_por_id(
            db, programacao_semanal_id
        )

        if not atual:
            raise HTTPException(
                detail='Programação semanal não encontrada',
                status_code=HTTPStatus.NOT_FOUND
            )

        resultado = await self.programacao_semanal_repository.deletar(
            db, programacao_semanal_id
        )

        if resultado is None:
            raise HTTPException(
                detail='Erro ao deletar a programação semanal',
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR
            )

        return {'message': 'Programação semanal deletada com sucesso.'}

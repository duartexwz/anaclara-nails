from http import HTTPStatus

from asyncpg import Connection
from fastapi import HTTPException

from api.repositories.clientes_repository import ClientesRepository
from api.schemas.clientes_schemas import (
    ClienteBase,
    ClienteFilter,
    ClienteUpdate,
)
from api.schemas.enums import TypeUserEnum
from api.schemas.global_schemas import UsuarioLogado


class ClientesServices:
    def __init__(self):
        self.clientes_repository = ClientesRepository()

    @staticmethod
    def _apenas_digitos(v: str | None) -> str | None:
        if v is None:
            return None
        d = ''.join(ch for ch in v if ch.isdigit())
        return d or None

    async def create_cliente(
        self,
        db: Connection,
        cliente: ClienteBase
    ) -> dict:

        # Normaliza máscaras (front envia "(00) 00000-0000" / "000.000.000-00")
        # para dígitos puros antes de validar unicidade e persistir.
        if cliente.telefone:
            cliente.telefone = self._apenas_digitos(cliente.telefone) or cliente.telefone
        if cliente.cpf:
            cliente.cpf = self._apenas_digitos(cliente.cpf) or cliente.cpf

        if (
            cliente.nome and await self.clientes_repository.existe(
                db, 'nome', cliente.nome
            )
        ):
            raise HTTPException(
                detail='O nome já pertence a um cliente cadastrado',
                status_code=HTTPStatus.CONFLICT
            )
        if (
            cliente.telefone and await self.clientes_repository.existe(
                db, 'telefone', cliente.telefone
            )
        ):
            raise HTTPException(
                detail='O telefone já pertence a um cliente cadastrado',
                status_code=HTTPStatus.CONFLICT
            )
        if (
            cliente.cpf and await self.clientes_repository.existe(
                db, 'cpf', cliente.cpf
            )
        ):
            raise HTTPException(
                detail='Já existe um cliente cadastrado com o cpf inserido',
                status_code=HTTPStatus.CONFLICT
            )

        dados = cliente.model_dump()
        # Colunas NOT NULL com DEFAULT no banco (005): INSERT explícito com
        # NULL quebra o DEFAULT e gera NotNullViolationError. Normaliza aqui
        # para o caso de o cliente enviar null ou de payload legado omitir.
        if dados.get("pref_app") is None:
            dados["pref_app"] = True
        if dados.get("pref_email") is None:
            dados["pref_email"] = True
        if dados.get("pref_whatsapp") is None:
            dados["pref_whatsapp"] = False
        # Garante que o que vai ao banco já está normalizado (caso model_dump
        # tenha sido chamado antes da normalização em algum fluxo legado).
        if dados.get("telefone"):
            dados["telefone"] = self._apenas_digitos(str(dados["telefone"])) or dados["telefone"]
        if dados.get("cpf"):
            dados["cpf"] = self._apenas_digitos(str(dados["cpf"])) or dados["cpf"]

        resultado = await self.clientes_repository.criar(
            db, dados
        )

        if resultado is None:
            raise HTTPException(
                detail='Erro ao cadastrar o cliente',
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR
            )

        return resultado

    async def get_clientes(
        self,
        db: Connection,
        filtrar: ClienteFilter,
        current_user: UsuarioLogado
    ) -> dict:

        if filtrar.telefone:
            filtrar.telefone = self._apenas_digitos(filtrar.telefone) or filtrar.telefone
        clientes = await self.clientes_repository.buscar(
            db, filtrar
        )

        return clientes


    async def update_clientes(
        self,
        db: Connection,
        cliente_id: int,
        cliente: ClienteUpdate,
        current_user: UsuarioLogado
    ) -> dict:


        atual = await self.clientes_repository.buscar_por_id(
            db, cliente_id
        )

        if not atual:
            raise HTTPException(
                detail='Cliente não encontrado',
                status_code=HTTPStatus.NOT_FOUND
            )

        dados = cliente.model_dump(exclude_unset=True)
        if "telefone" in dados and dados["telefone"] is not None:
            dados["telefone"] = self._apenas_digitos(str(dados["telefone"])) or dados["telefone"]
        if "cpf" in dados and dados["cpf"] is not None:
            dados["cpf"] = self._apenas_digitos(str(dados["cpf"])) or dados["cpf"]

        resultado = await self.clientes_repository.atualizar(
            db, cliente_id, dados
        )

        if resultado is None:
            raise HTTPException(
                detail='Erro ao atualizar os dados do cliente',
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR
            )

        return resultado

    async def delete_cliente(
        self,
        db: Connection,
        cliente_id: int,
        current_user: UsuarioLogado
    ) -> dict:

        if (
            current_user.type_user_id !=
            TypeUserEnum.ADMIN.value
        ):
            raise HTTPException(
                detail='A ação requer elevação',
                status_code=HTTPStatus.FORBIDDEN
            )

        atual = await self.clientes_repository.buscar_por_id(
            db, cliente_id
        )

        if not atual:
            raise HTTPException(
                detail='Cliente não encontrado',
                status_code=HTTPStatus.NOT_FOUND
            )

        resultado = await self.clientes_repository.deletar(
            db, cliente_id
        )

        if resultado is None:
            raise HTTPException(
                detail='Erro ao deletar o cliente',
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR
            )

        return {'message': 'Cliente deletado com sucesso.'}

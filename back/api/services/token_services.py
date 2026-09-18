from datetime import UTC, datetime, timedelta
from hashlib import sha256
from http import HTTPStatus
from secrets import token_urlsafe
from typing import Annotated, Any

from asyncpg import Connection
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm

from api.repositories.administradores_repository import (
    AdministradoresRepository,
)
from api.repositories.password_resets_repository import (
    PasswordResetsRepository,
)
from api.repositories.token_repository import LoginForAccessTokenRepository
from api.repositories.usuarios_repository import UsuarioRepository
from api.schemas.global_schemas import UsuarioLogado
from api.schemas.password_reset_schemas import (
    PasswordResetFilter,
    RecuperarSenha,
    RedefinirSenha,
)
from api.security import (
    create_access_token,
    create_refresh_token,
    get_password_hash,
    verify_password,
)
from api.services.email_service import enviar_email_recuperacao
from api.settings import settings
from api.schemas.enums import TypeUserEnum

oauth2_scheme = Annotated[OAuth2PasswordRequestForm, Depends()]


class TokenServices:
    def __init__(self):
        self.token_repository = LoginForAccessTokenRepository()
        self.admin_repository = AdministradoresRepository()

    @staticmethod
    def _senha_confere(senha: str, hashed: Any) -> bool:
        try:
            return bool(hashed) and verify_password(senha, hashed)
        except Exception:
            return False

    async def login_for_access_token(
        self, db: Connection, form_data: oauth2_scheme
    ):

        email = form_data.username or ''
        senha = form_data.password or ''

        # 1. TABELA ADMIN → LOGIN DE ADMINISTRADOR
        admin_record = await self.admin_repository.buscar_por_email(
            db, email
        )

        if admin_record:
            if not self._senha_confere(senha, admin_record.get('password')):
                raise HTTPException(
                    detail='Usuário ou senha inválidos',
                    status_code=HTTPStatus.UNAUTHORIZED
                )
            return await self._emitir_sessao(
                admin_record['id'], admin_record['nome'],
                admin_record['email'],
                type_user_id=admin_record['type_user_id'],
                is_admin=True, 
            )
        
        # 2. TABELA USUÁRIOS → LOGIN DE USUÁRIO (USER)
        user_record = await self.token_repository.buscar_por_email(
            db, email
        )

        if not user_record:
            raise HTTPException(
                detail='Usuário não cadastrado',
                status_code=HTTPStatus.UNAUTHORIZED
            )

        if not self._senha_confere(senha, user_record['password']):
            raise HTTPException(
                detail='Usuário ou senha inválidos',
                status_code=HTTPStatus.UNAUTHORIZED
            )
        

        return await self._emitir_sessao(
            user_record['id'], user_record['nome'],
            user_record['email'],
            type_user_id=user_record['type_user_id'],
            is_admin=user_record['type_user_id'] == TypeUserEnum.ADMIN.value
        )

    async def _emitir_sessao(
        self, user_id: int, nome: str, email: str, type_user_id: int,
        is_admin: bool
    ) -> dict:
        access_token = await create_access_token(
            data={
                'sub': email,
                'type_user_id': type_user_id
            }
        )
        refresh_token = await create_refresh_token(
            data={
                'sub': email,
                'type_user_id': type_user_id
            }
        )

        user = UsuarioLogado(
            id=user_id,
            nome=nome,
            email=email,
            type_user_id=type_user_id,
            is_admin=is_admin
        )

        return {
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': user
        }

    async def solicitar_recuperacao(
        self, db: Connection, dados: RecuperarSenha
    ) -> dict:
        ## SEMPRE 202 GENÉRICO (SEM ENUMERAR E-MAILS CADASTRADOS)
        email = dados.email.strip().lower()
        usuario = await self.token_repository.buscar_por_email(db, email)
        if not usuario:
            usuario = await self.admin_repository.buscar_por_email(
                db, email
            )

        if usuario:
            token = token_urlsafe(32)
            expira = datetime.now(UTC) + timedelta(minutes=30)
            await PasswordResetsRepository().criar(
                db,
                {
                    'usuario_id': usuario['id'],
                    'token_hash': sha256(token.encode()).hexdigest(),
                    'expira_em': expira,
                    'usado_em': None,
                },
            )
            link = (
                f"{settings.FRONTEND_URL.rstrip('/')}"
                f"/redefinir-senha?token={token}"
            )
            await enviar_email_recuperacao(email, link)

        return {'message': 'Se o e-mail existir, o link foi enviado.'}

    async def redefinir_senha(
        self, db: Connection, dados: RedefinirSenha
    ) -> dict:
        digest = sha256(dados.token.encode()).hexdigest()
        registros = await PasswordResetsRepository().buscar(
            db, PasswordResetFilter(token_hash=digest)
        )
        registro = registros[0] if registros else None

        agora = datetime.now(UTC)
        if not registro:
            raise HTTPException(
                detail='Link inválido ou expirado',
                status_code=HTTPStatus.BAD_REQUEST
            )
        expira = registro.get('expira_em')
        if isinstance(expira, str):
            expira = datetime.fromisoformat(expira)
        if expira is not None and expira.tzinfo is None:
            expira = expira.replace(tzinfo=UTC)
        if (
            registro.get('usado_em') is not None
            or expira is None
            or expira < agora
        ):
            raise HTTPException(
                detail='Link inválido ou expirado',
                status_code=HTTPStatus.BAD_REQUEST
            )

        atualizado = await UsuarioRepository().atualizar(
            db,
            registro['usuario_id'],
            {'password': get_password_hash(dados.nova_senha)},
        )
        if atualizado is None:
            atualizado = await AdministradoresRepository().atualizar(
                db,
                registro['usuario_id'],
                {'password': get_password_hash(dados.nova_senha)},
            )
        if atualizado is None:
            raise HTTPException(
                detail='Link inválido ou expirado',
                status_code=HTTPStatus.BAD_REQUEST
            )
        await PasswordResetsRepository().atualizar(
            db, registro['id'], {'usado_em': agora}
        )

        return {'message': 'Senha redefinida com sucesso.'}

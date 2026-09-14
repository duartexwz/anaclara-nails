
from pydantic import BaseModel, EmailStr, Field


class RecuperarSenha(BaseModel):
    email: EmailStr


class RedefinirSenha(BaseModel):
    token: str = Field(min_length=20)
    nova_senha: str = Field(min_length=8)


class PasswordResetFilter(BaseModel):
    token_hash: str | None = None
    usuario_id: int | None = None
    offset: int | None = 0
    limit: int | None = 10

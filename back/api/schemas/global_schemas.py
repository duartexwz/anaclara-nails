from pydantic import BaseModel


class UsuarioLogado(BaseModel):
    id: int
    nome: str | None = None
    email: str
    type_user_id: int
    is_admin: bool
    # Vínculo da conta administrativa com a profissional (nail designer).
    # Só é preenchido para contas criadas em `administradores` com type 3.
    nail_design_id: int | None = None

class Token(BaseModel):
    access_token: str
    token_type: str

class FilterPage(BaseModel):
    offset: int = 0
    limit: int = 10

class MessageGlobal(BaseModel):
    message: str

class TokenGlobal(BaseModel):
    access_token: str
    token_type: str

class LoginResponse(BaseModel):
    user: UsuarioLogado
    access_token: str
    refresh_token: str

class MeResponse(BaseModel):
    user: UsuarioLogado

class RefreshRequest(BaseModel):
    refresh_token: str | None = None

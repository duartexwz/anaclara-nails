from pydantic import BaseModel


class UsuarioLogado(BaseModel):
    id: int
    email: str
    type_user_id: int
    is_admin: bool

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

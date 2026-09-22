from pydantic import ConfigDict, BaseModel, EmailStr
from typing import Optional


class UsuarioBase(BaseModel):
    nome: str
    email: str
    password: str
    type_user_id: Optional[int] = None

class UsuarioResponse(BaseModel):
    id: int
    nome: str
    email: EmailStr
    type_user_id: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)

class UsuarioList(BaseModel):
    usuarios: list[UsuarioResponse]

class UsuarioUpdate(BaseModel):
    nome: str
    email: Optional[str] = None
    password: Optional[str] = None
    type_user_id: Optional[int] = None

class UsuarioFilter(BaseModel):
    nome: Optional[str] | None = None
    email: Optional[str] = None
    type_user_id: Optional[int] = None
    offset: int | None = 0
    limit: int | None = 10

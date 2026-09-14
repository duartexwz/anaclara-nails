from pydantic import ConfigDict, BaseModel, EmailStr
from typing import Optional


class UsuarioBase(BaseModel):
    email: str
    password: str
    type_user_id: Optional[int] = None

class UsuarioResponse(BaseModel):
    id: int
    email: EmailStr
    type_user_id: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)

class UsuarioList(BaseModel):
    usuarios: list[UsuarioResponse]

class UsuarioUpdate(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    type_user_id: Optional[int] = None

class UsuarioFilter(BaseModel):
    email: Optional[str] = None
    type_user_id: Optional[int] = None
    offset: int | None = 0
    limit: int | None = 10

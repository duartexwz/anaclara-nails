from pydantic import ConfigDict, BaseModel, EmailStr
from typing import Optional


class AdministradorBase(BaseModel):
    nome: str
    email: EmailStr
    password: str
    type_user_id: int
    nail_design_id: Optional[int] = None

class AdministradorResponse(BaseModel):
    id: int
    nome: str
    email: EmailStr
    type_user_id: int
    nail_design_id: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)

class AdministradorList(BaseModel):
    administradores: list[AdministradorResponse]

class AdministradorUpdate(BaseModel):
    nome: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    type_user_id: Optional[int] = None
    nail_design_id: Optional[int] = None

class AdministradorFilter(BaseModel):
    nome: Optional[str] = None
    email: Optional[EmailStr] = None
    type_user_id: Optional[int] = None
    nail_design_id: Optional[int] = None
    offset: int | None = 0
    limit: int | None = 10

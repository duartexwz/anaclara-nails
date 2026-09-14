from pydantic import ConfigDict, BaseModel, EmailStr
from typing import Optional

class NailDesignBase(BaseModel):
    nome: str
    cpf: str
    telefone: str

class NailDesignResponse(NailDesignBase):
    id: int
    nome: str
    cpf: str
    telefone: str
    model_config = ConfigDict(from_attributes=True)

class NailDesignList(BaseModel):
    nails_designs: list[NailDesignResponse]

class NailDesignUpdate(BaseModel):
    nome: Optional[str] = None
    cpf: Optional[str] = None
    telefone: Optional[str] = None

class NailDesignFilter(BaseModel):
    nome: Optional[str] = None
    cpf: Optional[str] = None
    telefone: Optional[str] = None
    offset: int | None = 0
    limit: int | None = 10




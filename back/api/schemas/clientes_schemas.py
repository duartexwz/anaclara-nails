
from pydantic import ConfigDict, BaseModel
from datetime import date


class ClienteBase(BaseModel):
    nome: str
    telefone: str
    email_id: int
    molde: str | None = None
    cpf: str | None = None
    data_nascimento: date | None = None
    pref_app: bool | None = True
    pref_email: bool | None = True
    pref_whatsapp: bool | None = False


class ClienteResponse(ClienteBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class ClienteList(BaseModel):
    clientes: list[ClienteResponse]

class ClienteUpdate(BaseModel):
    nome: str | None = None
    telefone: str | None = None
    email_id: int | None = None
    molde: str | None = None
    cpf: str | None = None
    data_nascimento: date | None = None
    pref_app: bool | None = None
    pref_email: bool | None = None
    pref_whatsapp: bool | None = None

class ClienteFilter(BaseModel):
    nome: str | None = None
    telefone: str | None = None
    email_id: int | None = None
    offset: int | None = 0
    limit: int | None = 10

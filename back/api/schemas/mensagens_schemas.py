
from pydantic import ConfigDict, BaseModel


class MensagemBase(BaseModel):
    agendamento_id: int | None = None
    remetente: str = 'admin'
    texto: str

class MensagemResponse(MensagemBase):
    id: int
    lida: bool
    model_config = ConfigDict(from_attributes=True)

class MensagemList(BaseModel):
    mensagens: list[MensagemResponse]

class MensagemUpdate(BaseModel):
    lida: bool | None = None

class MensagemFilter(BaseModel):
    agendamento_id: int | None = None
    remetente: str | None = None
    offset: int | None = 0
    limit: int | None = 50

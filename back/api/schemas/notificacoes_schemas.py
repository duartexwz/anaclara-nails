
from datetime import datetime

from pydantic import ConfigDict, BaseModel


class NotificacaoBase(BaseModel):
    tipo: str
    titulo: str
    mensagem: str
    agendamento_id: int | None = None


class NotificacaoResponse(NotificacaoBase):
    id: int
    lida: bool
    created_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)


class NotificacaoList(BaseModel):
    notificacoes: list[NotificacaoResponse]


class NotificacaoFilter(BaseModel):
    tipo: str | None = None
    lida: bool | None = None
    offset: int | None = 0
    limit: int | None = 20

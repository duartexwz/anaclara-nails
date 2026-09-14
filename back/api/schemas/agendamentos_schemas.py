from pydantic import ConfigDict, BaseModel
from typing import Optional
from datetime import date, time


class AgenamentoBase(BaseModel):
    cliente_id: int
    modelo_id: int
    horario: time
    sinal: float
    status_pagamentos_id: Optional[int] = None
    data: Optional[date] = None

class AgendamentoResponse(AgenamentoBase):
    id: int
    modelo_id: int
    horario: time
    sinal: float
    status_pagamentos_id: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)

class AgendamentoList(BaseModel):
    agendamentos: list[AgendamentoResponse]

class AgendamentoUpdate(BaseModel):
    cliente_id: Optional[int] = None
    modelo_id: Optional[int] = None
    horario: Optional[time] = None
    sinal: Optional[float] = None
    status_pagamentos_id: Optional[int] = None
    data: Optional[date] = None

class AgendamentoFilter(BaseModel):
    cliente_id: Optional[int] = None
    modelo_id: Optional[int] = None
    horario: Optional[time] = None
    sinal: Optional[float] = None
    status_pagamentos_id: Optional[int] = None
    data: Optional[date] = None
    offset: int | None = 0
    limit: int | None = 10

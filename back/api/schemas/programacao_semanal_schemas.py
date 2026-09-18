from pydantic import ConfigDict, BaseModel
from typing import Optional
from datetime import time


class ProgramacaoSemanalBase(BaseModel):
    profissional_id: int
    dia_semana: str
    ativo: bool
    inicio_expediente: time
    fim_expediente: time
    pausa_duracao: time
    intervalo_minutos: int


class ProgramacaoSemanalResponse(ProgramacaoSemanalBase):
    id: int
    profissional_id: int
    dia_semana: str
    ativo: bool
    inicio_expediente: time
    fim_expediente: time
    pausa_duracao: time
    intervalo_minutos: int
    model_config = ConfigDict(from_attributes=True)

class ProgramacaoSemanalList(BaseModel):
    programacoes_semanais: list[ProgramacaoSemanalResponse]

class ProgramacaoSemanalUpdate(BaseModel):
    profissional_id: Optional[int] = None
    dia_semana: Optional[str] = None
    ativo: Optional[bool] = None
    inicio_expediente: Optional[time] = None
    fim_expediente: Optional[time] = None
    pausa_duracao: Optional[time] = None
    intervalo_minutos: Optional[int] = None

class ProgramacaoSemanalFilter(BaseModel):
    profissional_id: Optional[int] = None
    dia_semana: Optional[str] = None
    ativo: Optional[bool] = None
    inicio_expediente: Optional[time] = None
    fim_expediente: Optional[time] = None
    pausa_duracao: Optional[time] = None
    offset: int | None = 0
    limit: int | None = 10


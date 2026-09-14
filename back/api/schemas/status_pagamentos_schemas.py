from pydantic import ConfigDict, BaseModel
from typing import Optional

class StatusPagamentoBase(BaseModel):
    nome: str

class StatusPagamentoResponse(StatusPagamentoBase):
    id: int
    nome: str
    model_config = ConfigDict(from_attributes=True)

class StatusPagamentoList(BaseModel):
    status_pagamentos: list[StatusPagamentoResponse]

class StatusPagamentoUpdate(BaseModel):
    nome: Optional[str] = None

class StatusPagamentoFilter(BaseModel):
    nome: Optional[str] = None
    offset: int | None = 0
    limit: int | None = 10


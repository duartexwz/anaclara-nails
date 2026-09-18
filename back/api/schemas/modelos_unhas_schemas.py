from pydantic import ConfigDict, BaseModel, field_validator
from datetime import time
from typing import Optional

class ModeloUnhaBase(BaseModel):
    nome: str
    valor_total: float
    categoria: str
    descricao: str
    duracao: time
    imagem_url: Optional[str] = None
    ativo: bool = True
    destaque: bool = False

    @field_validator("duracao", mode='before')
    @classmethod
    def parse_duracao(cls, value):
        partes = value.split(':')
        if len(partes) == 2:
            return time(int(partes[0]), int(partes[1]))
        elif len(partes) == 3:
            return time(int(partes[0]), int(partes[1]),
            int(partes[2])
            )
        return value

class ModeloUnhaResponse(ModeloUnhaBase):
    id: int
    nome: str
    valor_total: float
    categoria: str
    descricao: str
    duracao: time
    model_config = ConfigDict(from_attributes=True)

class ModeloUnhaList(BaseModel):
    modelos_unhas: list[ModeloUnhaResponse]


class ModeloUnhaUpdate(BaseModel):
    nome: Optional[str] = None
    valor_total: Optional[float] = None
    categoria: Optional[str] = None
    descricao: Optional[str] = None
    duracao: Optional[time] = None
    imagem_url: Optional[str] = None
    ativo: Optional[bool] = None
    destaque: Optional[bool] = None

class ModeloUnhaFilter(BaseModel):
    nome: Optional[str] = None
    valor_total: Optional[float] = None
    categoria: Optional[str] = None
    descricao: Optional[str] = None
    duracao: Optional[time] = None
    offset: int | None = 0
    limit: int | None = 10
    
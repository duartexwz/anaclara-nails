from datetime import date

from pydantic import ConfigDict, BaseModel


class BloqueioBase(BaseModel):
    data: date
    motivo: str

class BloqueioResponse(BloqueioBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class BloqueioList(BaseModel):
    bloqueios: list[BloqueioResponse]

class BloqueioFilter(BaseModel):
    offset: int | None = 0
    limit: int | None = 100

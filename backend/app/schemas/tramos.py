from datetime import date, datetime

from pydantic import BaseModel


class TramoListaItem(BaseModel):
    id: int
    fecha: date  # de tiempo.dia (embed)
    persona_id: str
    persona_nombre: str | None = None
    inicio: datetime
    fin: datetime | None
    minutos_trabajados: float | None


class TramoListaOut(BaseModel):
    total: int
    tramos: list[TramoListaItem]

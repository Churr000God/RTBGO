from datetime import datetime

from pydantic import BaseModel


class BancoDeHorasOut(BaseModel):
    persona_id: str
    persona_nombre: str | None
    monto: float
    vivo_desde: datetime | None
    actualizado_en: datetime

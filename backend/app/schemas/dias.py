from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel

EstadoDia = Literal["abierto", "cerrado", "bloqueado", "revisado"]
OrigenDia = Literal["automatico_confianza", "ausencia_autorizada"]
AlertaEntrada = Literal["retardo", "entrada_anticipada"]
AlertaSalida = Literal["salida_anticipada", "salida_tardia"]


class DiaListaItem(BaseModel):
    id: int
    fecha: date
    persona_id: str
    persona_nombre: str | None = None
    estado: EstadoDia
    horas_totales: float | None
    origen: OrigenDia | None
    primera_marca: datetime | None
    ultima_marca: datetime | None
    alerta_entrada: AlertaEntrada | None = None
    alerta_salida: AlertaSalida | None = None


class DiaListaOut(BaseModel):
    total: int
    dias: list[DiaListaItem]


class DiaRevisadoOut(BaseModel):
    id: int
    persona_id: str
    persona_nombre: str | None = None
    fecha: date
    estado: EstadoDia
    horas_totales: float | None
    origen: OrigenDia | None
    revisado_por: str | None
    revisado_en: datetime | None

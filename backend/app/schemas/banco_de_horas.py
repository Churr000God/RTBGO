from datetime import datetime

from pydantic import BaseModel


class BancoDeHorasItem(BaseModel):
    persona_id: str
    persona_nombre: str | None = None
    monto: float
    vivo_desde: datetime | None
    actualizado_en: datetime
    horas_reciente: float
    horas_media: float
    horas_fuera_ventana: float
    meses_antiguedad_max: int
    conciliado: bool


class TopEnDeudaItem(BaseModel):
    persona_id: str
    persona_nombre: str | None = None
    monto: float
    meses_antiguedad_max: int


class BancoDeHorasResumen(BaseModel):
    total_personas: int
    en_deuda: int
    sin_deuda: int
    horas_adeudadas: float
    horas_fuera_ventana: float
    personas_fuera_ventana: int
    ventana_meses: int
    top_en_deuda: list[TopEnDeudaItem]


class BancoDeHorasListaOut(BaseModel):
    total: int
    resumen: BancoDeHorasResumen
    saldos: list[BancoDeHorasItem]


class MovimientoSaldoItem(BaseModel):
    id: int
    creado_en: datetime
    tipo: str
    monto: float
    motivo: str | None
    autor_nombre: str | None = None
    saldo_corrido: float
    vivo: bool


class MovimientoSaldoListaOut(BaseModel):
    total: int
    movimientos: list[MovimientoSaldoItem]

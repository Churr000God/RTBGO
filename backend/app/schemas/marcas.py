from datetime import datetime

from pydantic import BaseModel, field_validator


class MarcaCapturaManualCreate(BaseModel):
    evento_id: str  # UUID v4, generado por el frontend al montar el formulario (SCJ-ESP-01 §VII.4)
    persona_id: str
    terminal_id: str  # punto de captura (ej. "rh-captura-01"), no un aparato físico

    @field_validator("terminal_id")
    @classmethod
    def validar_terminal_id(cls, valor: str) -> str:
        valor = valor.strip()
        if not valor or len(valor) > 32:
            raise ValueError("terminal_id debe tener entre 1 y 32 caracteres")
        return valor


class MarcaCapturaManualOut(BaseModel):
    evento_id: str
    duplicado: bool
    momento_recepcion: datetime
    requiere_revision: bool
    motivos_revision: list[str]

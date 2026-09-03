from datetime import date

from pydantic import BaseModel


class PersonaCreate(BaseModel):
    primer_nombre: str
    segundo_nombre: str | None = None
    apellido_paterno: str
    apellido_materno: str | None = None
    curp: str
    rfc: str
    nss: str
    fecha_nacimiento: date
    fecha_ingreso: date
    tipo_contrato: str  # indefinido | prestacion_servicios | por_proyecto
    documento_ref: str  # formato RTB-__-__


class PersonaOut(BaseModel):
    id: str
    primer_nombre: str
    segundo_nombre: str | None
    apellido_paterno: str
    apellido_materno: str | None
    curp: str
    rfc: str
    nss: str
    fecha_nacimiento: date
    fecha_ingreso: date
    estado: str


class PersonaConExpediente(PersonaOut):
    tipo_contrato: str
    documento_ref: str

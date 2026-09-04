from datetime import date

from pydantic import BaseModel, field_validator


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

    @field_validator("curp", "rfc")
    @classmethod
    def normalizar_mayusculas(cls, valor: str) -> str:
        """04_personas.sql documenta que curp/rfc no se validan por formato en la DB — se deja a
        la capa de aplicación. Normaliza aquí (no sólo en el frontend) porque alguien podría
        pegarle directo a la API sin pasar por el form."""
        return valor.strip().upper()


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
    fecha_baja: date | None = None
    estado: str


class PuestoVigente(BaseModel):
    asignacion_id: str
    puesto_id: str
    nombre_puesto: str
    nombre_departamento: str
    nombre_area: str


class PersonaConExpediente(PersonaOut):
    tipo_contrato: str | None = None
    documento_ref: str | None = None
    tiene_usuario: bool = False
    puestos_vigentes: list[PuestoVigente] = []

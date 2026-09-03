from fastapi import APIRouter, Depends
from supabase import Client

from app.deps import get_caller_client
from app.schemas.personas import PersonaCreate, PersonaOut

router = APIRouter(prefix="/api/personas", tags=["personas"])


@router.post("", status_code=201, response_model=PersonaOut)
def alta_persona(datos: PersonaCreate, db: Client = Depends(get_caller_client)) -> dict:
    """SCJ-PRO-01 paso A1: persona + expediente en una misma operación, en ese orden por la FK."""
    persona = (
        db.postgrest.schema("personas")
        .table("persona")
        .insert(
            {
                "primer_nombre": datos.primer_nombre,
                "segundo_nombre": datos.segundo_nombre,
                "apellido_paterno": datos.apellido_paterno,
                "apellido_materno": datos.apellido_materno,
                "curp": datos.curp,
                "rfc": datos.rfc,
                "nss": datos.nss,
                "fecha_nacimiento": datos.fecha_nacimiento.isoformat(),
                "fecha_ingreso": datos.fecha_ingreso.isoformat(),
            }
        )
        .execute()
        .data[0]
    )

    db.postgrest.schema("personas").table("expediente").insert(
        {
            "persona_id": persona["id"],
            "tipo_contrato": datos.tipo_contrato,
            "documento_ref": datos.documento_ref,
        }
    ).execute()

    return persona

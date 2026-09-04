from fastapi import APIRouter, Depends
from supabase import Client

from app.deps import get_caller_client
from app.schemas.personas import PersonaConExpediente, PersonaCreate, PersonaOut

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


@router.get("", response_model=list[PersonaOut])
def listar_personas(db: Client = Depends(get_caller_client)) -> list[dict]:
    return db.postgrest.schema("personas").table("persona").select("*").execute().data


@router.get("/{persona_id}", response_model=PersonaConExpediente)
def ficha_persona(persona_id: str, db: Client = Depends(get_caller_client)) -> dict:
    fila = (
        db.postgrest.schema("personas")
        .table("persona")
        .select("*, expediente(tipo_contrato, documento_ref)")
        .eq("id", persona_id)
        .single()
        .execute()
        .data
    )
    # Persona insertada sin pasar por POST /api/personas (ej. datos de prueba por SQL directo)
    # puede no tener fila en expediente — el embed de PostgREST devuelve null, no {}.
    expediente = fila.pop("expediente") or {}

    tiene_usuario = bool(
        db.postgrest.schema("personas")
        .table("usuario")
        .select("auth_user_id")
        .eq("persona_id", persona_id)
        .execute()
        .data
    )

    return {**fila, **expediente, "tiene_usuario": tiene_usuario}

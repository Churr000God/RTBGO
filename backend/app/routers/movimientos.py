from fastapi import APIRouter, Depends
from supabase import Client

from app.deps import get_caller_client
from app.schemas.movimientos import MovimientoCreate, MovimientoOut

router = APIRouter(prefix="/api/personas/{persona_id}/movimientos", tags=["movimientos"])


@router.post("", status_code=201, response_model=MovimientoOut)
def crear_movimiento(
    persona_id: str, datos: MovimientoCreate, db: Client = Depends(get_caller_client)
) -> dict:
    """SCJ-PRO-02: el trigger trg_bitacora_sincroniza_persona actualiza persona.estado solo —
    este endpoint nunca hace UPDATE directo a personas.persona."""
    return (
        db.postgrest.schema("personas")
        .table("bitacora_movimiento_persona")
        .insert(
            {
                "persona_id": persona_id,
                "tipo_movimiento": datos.tipo_movimiento,
                "motivo": datos.motivo,
            }
        )
        .execute()
        .data[0]
    )


@router.get("", response_model=list[MovimientoOut])
def listar_movimientos(persona_id: str, db: Client = Depends(get_caller_client)) -> list[dict]:
    return (
        db.postgrest.schema("personas")
        .table("bitacora_movimiento_persona")
        .select("*")
        .eq("persona_id", persona_id)
        .order("fecha_efectiva", desc=True)
        .execute()
        .data
    )

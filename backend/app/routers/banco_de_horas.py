"""API de tiempo.banco_de_horas (sólo lectura) -- SCJ-DEC-02/SCJ-PRO-13. monto/vivo_desde son
materializados por trigger (fn_movimiento_de_saldo_actualiza_banco), nadie los edita a mano acá
-- este router sólo expone el GET.

persona_nombre se resuelve del lado del servidor cruzando tiempo.banco_de_horas.persona_id ->
personas.persona (mismo criterio que routers/excepciones.py y routers/ausencias.py).

Gate: get_caller_client (RLS) + requiere_permiso("banco_de_horas_lectura") -- único código del
catálogo para este recurso (sólo lectura, no existe banco_de_horas_edicion; se materializa por
trigger, no por escritura humana)."""

from fastapi import APIRouter, Depends
from supabase import Client

from app.deps import get_caller_client
from app.permisos import requiere_permiso
from app.schemas.banco_de_horas import BancoDeHorasOut

router = APIRouter(prefix="/api/banco-de-horas", tags=["banco-de-horas"])


def _resolver_nombres_persona(db: Client, persona_ids: list[str]) -> dict[str, str]:
    ids = sorted(set(persona_ids))
    if not ids:
        return {}
    personas = (
        db.postgrest.schema("personas")
        .table("persona")
        .select("id, primer_nombre, apellido_paterno")
        .in_("id", ids)
        .execute()
        .data
    )
    return {
        persona["id"]: f"{persona['primer_nombre']} {persona['apellido_paterno']}"
        for persona in personas
    }


@router.get("", response_model=list[BancoDeHorasOut])
def listar_banco_de_horas(
    db: Client = Depends(get_caller_client),
    _permiso: None = Depends(requiere_permiso("banco_de_horas_lectura")),
) -> list[dict]:
    filas = (
        db.postgrest.schema("tiempo")
        .table("banco_de_horas")
        .select("persona_id, monto, vivo_desde, actualizado_en")
        .execute()
        .data
    )
    nombres = _resolver_nombres_persona(db, [fila["persona_id"] for fila in filas])
    return [
        {**fila, "persona_nombre": nombres.get(fila["persona_id"])}
        for fila in filas
    ]

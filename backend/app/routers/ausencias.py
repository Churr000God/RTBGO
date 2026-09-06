"""API de tiempo.ausencia/tiempo.aprobacion_ausencia (SCJ-PRO-08). Único flujo de ausencia hoy:
el sistema la crea (batch de cierre de día, Fase 4, todavía no existe) con
tipo_de_ausencia='falta' (placeholder) y estado_autorizacion='pendiente'; este router cubre la
resolución humana -- un solo paso, sin jerarquía, cualquiera de los 3 puestos con el permiso.

Gate: get_caller_client (RLS) -- nunca service_role. Resolver invoca
tiempo.fn_ausencia_resolver (RPC transaccional, SECURITY INVOKER) -- reclasificar tipo_de_ausencia
+ aprobar quedan en una sola transacción real (a diferencia del primer corte de este router, que
hacía UPDATE + INSERT en dos llamadas REST separadas). requiere_todos_los_permisos(...) sigue
haciendo falta para el 403 legible antes de llegar a la BD -- la RLS real (ausencia_edicion +
aprobacion_ausencia_edicion) es la autorización insaltable.

persona_nombre se resuelve del lado del servidor cruzando tiempo.ausencia.persona_id ->
personas.persona (mismo criterio que routers/excepciones.py::_resolver_detalle_marca) -- sin
esto, la bandeja de RH no tiene forma de saber de quién es la ausencia que está resolviendo."""

from fastapi import APIRouter, Depends, HTTPException, status
from postgrest.exceptions import APIError
from supabase import Client

from app.deps import get_caller_client
from app.permisos import requiere_permiso, requiere_todos_los_permisos
from app.schemas.ausencias import AusenciaOut, ResolverAusenciaCreate

router = APIRouter(prefix="/api/ausencias", tags=["ausencias"])

UNIQUE_VIOLATION = "23505"
CODIGO_AUSENCIA_NO_ENCONTRADA = "SCJ02"
CODIGO_AUSENCIA_YA_RESUELTA = "SCJ03"
CODIGO_TIPO_INVALIDO = "SCJ04"

MENSAJE_AUSENCIA_NO_ENCONTRADA = "La ausencia no existe."
MENSAJE_AUSENCIA_YA_RESUELTA = "Esta ausencia ya fue resuelta -- alguien más se te adelantó."


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


def _con_nombre(db: Client, fila: dict) -> dict:
    nombres = _resolver_nombres_persona(db, [fila["persona_id"]])
    return {**fila, "persona_nombre": nombres.get(fila["persona_id"])}


def _con_nombres(db: Client, filas: list[dict]) -> list[dict]:
    nombres = _resolver_nombres_persona(db, [fila["persona_id"] for fila in filas])
    return [{**fila, "persona_nombre": nombres.get(fila["persona_id"])} for fila in filas]


@router.get("/pendientes", response_model=list[AusenciaOut])
def listar_ausencias_pendientes(
    db: Client = Depends(get_caller_client),
    _permiso: None = Depends(requiere_permiso("ausencia_lectura", "ausencia_edicion")),
) -> list[dict]:
    filas = (
        db.postgrest.schema("tiempo")
        .table("ausencia")
        .select("*")
        .eq("estado_autorizacion", "pendiente")
        .order("fecha_inicio")
        .execute()
        .data
    )
    return _con_nombres(db, filas)


@router.post("/{ausencia_id}/resolver", response_model=AusenciaOut)
def resolver_ausencia(
    ausencia_id: int,
    datos: ResolverAusenciaCreate,
    db: Client = Depends(get_caller_client),
    _permiso: None = Depends(
        requiere_todos_los_permisos("ausencia_edicion", "aprobacion_ausencia_edicion")
    ),
) -> dict:
    """SCJ-PRO-08 B1-H2. numero_paso=1 fijo dentro del RPC -- flujo de un solo paso, sin
    jerarquía. aprobador_id se resuelve solo vía auth.uid() dentro de la función, no hace falta
    resolverlo acá. trg_aprobacion_ausencia_actualiza_ausencia recalcula estado_autorizacion
    dentro de la misma transacción del RPC; no se fija a mano."""
    try:
        resultado = (
            db.postgrest.schema("tiempo")
            .rpc(
                "fn_ausencia_resolver",
                {
                    "p_ausencia_id": ausencia_id,
                    "p_decision": datos.decision,
                    "p_tipo_de_ausencia": datos.tipo_de_ausencia,
                    "p_motivo": datos.motivo,
                },
            )
            .execute()
        )
    except APIError as error:
        if error.code == CODIGO_AUSENCIA_NO_ENCONTRADA:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND, MENSAJE_AUSENCIA_NO_ENCONTRADA
            ) from error
        if error.code in (CODIGO_AUSENCIA_YA_RESUELTA, UNIQUE_VIOLATION):
            # SCJ03 (pre-chequeo dentro de la función) o 23505 real de uq_aprobacion_ausencia_
            # paso (H1-H2: dos personas resolviendo a la vez, la función no siempre alcanza a
            # adelantarse a la carrera) -- mismo mensaje en los dos casos.
            raise HTTPException(status.HTTP_409_CONFLICT, MENSAJE_AUSENCIA_YA_RESUELTA) from error
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, error.message) from error

    return _con_nombre(db, resultado.data)

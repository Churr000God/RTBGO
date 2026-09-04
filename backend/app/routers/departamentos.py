"""API del catálogo personas.departamento (SCJ-PRO-03 alta/renombrado, SCJ-PRO-06
desactivar/reactivar). Calcado de app/routers/areas.py -- mismo gate, misma forma de PATCH.

Gate de permisos: get_caller_client exige sólo Bearer token válido + RLS
(personas.fn_caller_activo(), policy solo_caller_activo) -- cualquier usuario autenticado y
activo puede crear, renombrar y desactivar/reactivar departamentos. No hay chequeo de
rol/permiso todavía: personas.permiso, personas.puesto_permiso y personas.asignacion no
existen. Cuando SCJ-PRO-05 se implemente, este router debe empezar a exigir
departamento_edicion/departamento_lectura.

reasignar el area_id de un departamento existente está fuera de alcance (decisión tomada con
el usuario) -- DepartamentoRename no acepta area_id, sólo AreaCreate lo tiene, y sólo en el
alta.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from postgrest.exceptions import APIError
from supabase import Client

from app.deps import get_caller_client
from app.schemas.departamentos import (
    DepartamentoCreate,
    DepartamentoEstado,
    DepartamentoOut,
    DepartamentoRename,
)

router = APIRouter(prefix="/api/departamentos", tags=["departamentos"])

UNIQUE_VIOLATION = "23505"
MENSAJE_DEPARTAMENTO_DUPLICADO = "Ya existe un departamento con ese nombre."
MENSAJE_DEPARTAMENTO_NO_ENCONTRADO = "Departamento no encontrado."
MENSAJE_AREA_INVALIDA = "El área no existe o está inactiva."


@router.get("", response_model=list[DepartamentoOut])
def listar_departamentos(db: Client = Depends(get_caller_client)) -> list[dict]:
    return (
        db.postgrest.schema("personas")
        .table("departamento")
        .select("*")
        .order("nombre_departamento")
        .execute()
        .data
    )


@router.post("", status_code=201, response_model=DepartamentoOut)
def alta_departamento(datos: DepartamentoCreate, db: Client = Depends(get_caller_client)) -> dict:
    """SCJ-PRO-03 D0-D3. area_id se valida antes del insert: departamento no tiene padre en
    area (a diferencia de area, que no tiene padre alguno), así que acá sí hace falta chequear
    que el area exista y esté activa -- si no, el error de FK de Postgres sería menos legible
    que este 422."""
    area = (
        db.postgrest.schema("personas")
        .table("area")
        .select("id, activo")
        .eq("id", datos.area_id)
        .execute()
        .data
    )
    if not area or not area[0]["activo"]:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, MENSAJE_AREA_INVALIDA)

    try:
        return (
            db.postgrest.schema("personas")
            .table("departamento")
            .insert({"area_id": datos.area_id, "nombre_departamento": datos.nombre_departamento})
            .execute()
            .data[0]
        )
    except APIError as error:
        if error.code == UNIQUE_VIOLATION:
            raise HTTPException(status.HTTP_409_CONFLICT, MENSAJE_DEPARTAMENTO_DUPLICADO) from error
        raise


@router.get("/{departamento_id}", response_model=DepartamentoOut)
def obtener_departamento(departamento_id: str, db: Client = Depends(get_caller_client)) -> dict:
    fila = (
        db.postgrest.schema("personas")
        .table("departamento")
        .select("*")
        .eq("id", departamento_id)
        .execute()
        .data
    )
    if not fila:
        raise HTTPException(status.HTTP_404_NOT_FOUND, MENSAJE_DEPARTAMENTO_NO_ENCONTRADO)
    return fila[0]


@router.patch("/{departamento_id}", response_model=DepartamentoOut)
def renombrar_departamento(
    departamento_id: str, datos: DepartamentoRename, db: Client = Depends(get_caller_client)
) -> dict:
    """SCJ-PRO-03 D1: renombrar departamento existente. Mismo 409 en duplicado que el alta."""
    try:
        fila = (
            db.postgrest.schema("personas")
            .table("departamento")
            .update(
                {
                    "nombre_departamento": datos.nombre_departamento,
                    "actualizado_en": datetime.now(timezone.utc).isoformat(),
                }
            )
            .eq("id", departamento_id)
            .execute()
            .data
        )
    except APIError as error:
        if error.code == UNIQUE_VIOLATION:
            raise HTTPException(status.HTTP_409_CONFLICT, MENSAJE_DEPARTAMENTO_DUPLICADO) from error
        raise
    if not fila:
        raise HTTPException(status.HTTP_404_NOT_FOUND, MENSAJE_DEPARTAMENTO_NO_ENCONTRADO)
    return fila[0]


@router.patch("/{departamento_id}/estado", response_model=DepartamentoOut)
def cambiar_estado_departamento(
    departamento_id: str, datos: DepartamentoEstado, db: Client = Depends(get_caller_client)
) -> dict:
    """SCJ-PRO-06 DD1 (desactivar) / RD1 (reactivar)."""
    # TODO SCJ-PRO-06 DD1: cuando exista personas.puesto, rechazar la desactivación
    # (activo=False) si algún puesto hijo de este departamento sigue activo=true. Hoy no hay
    # tabla puesto que consultar.
    fila = (
        db.postgrest.schema("personas")
        .table("departamento")
        .update(
            {
                "activo": datos.activo,
                "actualizado_en": datetime.now(timezone.utc).isoformat(),
            }
        )
        .eq("id", departamento_id)
        .execute()
        .data
    )
    if not fila:
        raise HTTPException(status.HTTP_404_NOT_FOUND, MENSAJE_DEPARTAMENTO_NO_ENCONTRADO)
    return fila[0]

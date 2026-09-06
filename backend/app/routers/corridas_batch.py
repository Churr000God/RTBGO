"""API de tiempo.corrida_batch -- botón manual de los batches del subsistema Tiempo. SCJ-PRO-14
(de_confianza) estrena el patrón; SCJ-PRO-12/13 (cierre_dia/corte_quincenal, Fase 4) lo van a
reusar sin volver a diseñarlo.

El batch en sí corre con service_role (app/batches/de_confianza.py -- es un proceso de sistema,
no un caller humano). Este endpoint sólo gatea el botón manual con permiso antes de invocarlo.

Gateado con corrida_batch_edicion (heredable, mapeado a Responsable de Recursos Humanos/Gerente
General/Gerente o Encargado de TI -- confirmado y aplicado por db). No existía en el catálogo
original de 33_*.sql (pensado originalmente sólo para lectura/edición de tablas concretas, no
para "disparar un proceso"); tiempo_persona_edicion no servía como stopgap porque 34_*.sql lo
deja deliberadamente fuera de RH/Gerente General."""

from datetime import date

from fastapi import APIRouter, Depends
from supabase import Client

from app.batches.de_confianza import ejecutar_batch_de_confianza
from app.deps import get_caller_client, get_service_client
from app.permisos import requiere_permiso
from app.schemas.corridas_batch import CorridaBatchOut, EjecutarBatchRequest

router = APIRouter(prefix="/api/corridas-batch", tags=["corridas-batch"])

CODIGO_PERMISO_BATCH = "corrida_batch_edicion"


@router.get("", response_model=list[CorridaBatchOut])
def listar_corridas_batch(
    db: Client = Depends(get_caller_client),
    _permiso: None = Depends(requiere_permiso(CODIGO_PERMISO_BATCH)),
) -> list[dict]:
    """Panel de estado de corridas (frontend). get_caller_client, no service_role -- es lectura
    humana; la RLS de tiempo.corrida_batch (armada por db) sólo exige fn_caller_activo(), sin
    permiso específico, pero se gatea igual acá por consistencia con el resto de los routers."""
    return (
        db.postgrest.schema("tiempo")
        .table("corrida_batch")
        .select("*")
        .order("fecha", desc=True)
        .execute()
        .data
    )


@router.post("/de-confianza", response_model=CorridaBatchOut)
def disparar_batch_de_confianza(
    datos: EjecutarBatchRequest = EjecutarBatchRequest(),
    db_servicio: Client = Depends(get_service_client),
    _permiso: None = Depends(requiere_permiso(CODIGO_PERMISO_BATCH)),
) -> dict:
    """SCJ-PRO-14 Z1: botón manual, misma invocación que el job programado (devops,
    APScheduler) -- ejecutar_batch_de_confianza es idempotente por persona, repetir la corrida
    del mismo día es seguro."""
    fecha_efectiva = datos.fecha or date.today()
    return ejecutar_batch_de_confianza(fecha_efectiva, db_servicio)

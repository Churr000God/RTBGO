"""API de tiempo.corrida_batch -- botón manual de los batches del subsistema Tiempo. SCJ-PRO-14
(de_confianza) estrenó el patrón; SCJ-PRO-12 (cierre_dia) y SCJ-PRO-13 (corte_quincenal) lo
reusan sin volver a diseñarlo.

Cada batch en sí corre con service_role (app/batches/*.py -- es un proceso de sistema, no un
caller humano). Este router sólo gatea el botón manual con permiso antes de invocarlo.

Gateado con corrida_batch_edicion (heredable, mapeado a Responsable de Recursos Humanos/Gerente
General/Gerente o Encargado de TI -- confirmado y aplicado por db). No existía en el catálogo
original de 33_*.sql (pensado originalmente sólo para lectura/edición de tablas concretas, no
para "disparar un proceso"); tiempo_persona_edicion no servía como stopgap porque 34_*.sql lo
deja deliberadamente fuera de RH/Gerente General."""

from datetime import date

from fastapi import APIRouter, Depends
from supabase import Client

from app.batches.cierre_dia import ejecutar_cierre_dia
from app.batches.corte_quincenal import ejecutar_corte_quincenal
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


@router.post("/cierre-dia", response_model=CorridaBatchOut)
def disparar_cierre_dia(
    datos: EjecutarBatchRequest = EjecutarBatchRequest(),
    db_servicio: Client = Depends(get_service_client),
    _permiso: None = Depends(requiere_permiso(CODIGO_PERMISO_BATCH)),
) -> dict:
    """SCJ-PRO-12 Z1: botón manual, misma invocación que el job programado -- ejecutar_cierre_dia
    es idempotente por persona (tiempo.dia ya resuelto se salta), repetir la corrida del mismo
    día es seguro."""
    fecha_efectiva = datos.fecha or date.today()
    return ejecutar_cierre_dia(fecha_efectiva, db_servicio)


@router.post("/corte-quincenal", response_model=CorridaBatchOut)
def disparar_corte_quincenal(
    datos: EjecutarBatchRequest = EjecutarBatchRequest(),
    db_servicio: Client = Depends(get_service_client),
    _permiso: None = Depends(requiere_permiso(CODIGO_PERMISO_BATCH)),
) -> dict:
    """SCJ-PRO-13 Z1: botón manual, misma invocación que el job programado -- ejecutar_corte_
    quincenal es idempotente por persona (cualquier tramo del periodo ya clasificado se salta),
    repetir la corrida es seguro. `fecha` (día 1 o 16, o cualquier otra si es un reproceso
    manual) determina el periodo -- ver _rango_periodo en app/batches/corte_quincenal.py."""
    fecha_efectiva = datos.fecha or date.today()
    return ejecutar_corte_quincenal(fecha_efectiva, db_servicio)

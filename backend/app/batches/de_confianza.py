"""Batch de jornada de_confianza (SCJ-PRO-14) -- el más simple de los tres batches del
subsistema Tiempo, estrena la orquestación job+botón+corrida_batch que cierre_dia/corte_quincenal
(Fase 4) van a reusar sin volver a diseñarla.

ejecutar_batch_de_confianza es el punto de entrada tanto del job programado (app/scheduler.py,
BackgroundScheduler de APScheduler en el lifespan de FastAPI, id fijo + replace_existing=True)
como del botón manual (routers/corridas_batch.py) -- misma invocación, mismo mecanismo de
corrida_batch e idempotencia por persona (SCJ-PRO-14 §III/§V). Corre como service_role: es un
proceso de sistema, no un caller humano sujeto a RLS."""

import logging
from datetime import date, datetime, timezone

from postgrest.exceptions import APIError
from supabase import Client

from app.config import get_settings
from app.deps import get_service_client

UNIQUE_VIOLATION = "23505"

logger = logging.getLogger(__name__)


def _releer_y_marcar_en_progreso(db: Client, fecha_iso: str, ahora: str) -> dict:
    fila = (
        db.postgrest.schema("tiempo")
        .table("corrida_batch")
        .select("id, intentos")
        .eq("tipo_batch", "de_confianza")
        .eq("fecha", fecha_iso)
        .execute()
        .data[0]
    )
    return (
        db.postgrest.schema("tiempo")
        .table("corrida_batch")
        .update(
            {
                "estado": "en_progreso",
                "intentos": fila["intentos"] + 1,
                "iniciado_en": ahora,
                "terminado_en": None,
                "detalle": None,
            }
        )
        .eq("id", fila["id"])
        .execute()
        .data[0]
    )


def _upsert_corrida_en_progreso(db: Client, fecha_iso: str) -> dict:
    """UPSERT manual, no .upsert() de postgrest -- 'intentos' se incrementa sobre el valor
    existente, algo que un upsert declarativo no puede expresar sin leer antes. Ventana de
    carrera entre el SELECT y el INSERT (el job programado y el botón manual cayendo a la vez
    para el mismo (tipo_batch, fecha)): si el INSERT revienta con 23505 sobre
    uq_corrida_batch_tipo_fecha, releer y actualizar en vez de propagar un 500 crudo -- mismo
    criterio que _crear_dia_si_no_existe."""
    existente = (
        db.postgrest.schema("tiempo")
        .table("corrida_batch")
        .select("id, intentos")
        .eq("tipo_batch", "de_confianza")
        .eq("fecha", fecha_iso)
        .execute()
        .data
    )
    ahora = datetime.now(timezone.utc).isoformat()
    if existente:
        fila = existente[0]
        return (
            db.postgrest.schema("tiempo")
            .table("corrida_batch")
            .update(
                {
                    "estado": "en_progreso",
                    "intentos": fila["intentos"] + 1,
                    "iniciado_en": ahora,
                    "terminado_en": None,
                    "detalle": None,
                }
            )
            .eq("id", fila["id"])
            .execute()
            .data[0]
        )
    try:
        return (
            db.postgrest.schema("tiempo")
            .table("corrida_batch")
            .insert(
                {
                    "tipo_batch": "de_confianza",
                    "fecha": fecha_iso,
                    "estado": "en_progreso",
                    "intentos": 1,
                    "iniciado_en": ahora,
                }
            )
            .execute()
            .data[0]
        )
    except APIError as error:
        if error.code == UNIQUE_VIOLATION:
            return _releer_y_marcar_en_progreso(db, fecha_iso, ahora)
        raise


def _personas_de_confianza_vigentes(db: Client, fecha_iso: str) -> list[str]:
    """jornada_asignada vigente en fecha: vigente_desde <= fecha y (vigente_hasta NULL o >=
    fecha) -- misma condición de vigencia que el resto del proyecto (SCJ-DEC-04)."""
    filas = (
        db.postgrest.schema("tiempo")
        .table("jornada_asignada")
        .select("persona_id")
        .eq("tipo_jornada", "de_confianza")
        .lte("vigente_desde", fecha_iso)
        .or_(f"vigente_hasta.is.null,vigente_hasta.gte.{fecha_iso}")
        .execute()
        .data
    )
    return [fila["persona_id"] for fila in filas]


def _crear_dia_si_no_existe(db: Client, persona_id: str, fecha_iso: str) -> bool:
    """True si creó el día, False si ya existía (idempotente -- SCJ-PRO-14 §III D1/D2).
    tiempo.dia tiene a lo sumo una fila por (persona_id, fecha) sin importar el origen
    (uq_dia_persona_fecha) -- probar el INSERT y atrapar 23505 evita una consulta extra."""
    try:
        db.postgrest.schema("tiempo").table("dia").insert(
            {
                "persona_id": persona_id,
                "fecha": fecha_iso,
                "estado": "cerrado",
                "horas_totales": None,
                "origen": "automatico_confianza",
            }
        ).execute()
        return True
    except APIError as error:
        if error.code == UNIQUE_VIOLATION:
            return False
        raise


def ejecutar_batch_de_confianza(fecha: date, db: Client | None = None) -> dict:
    """SCJ-PRO-14 A1-G3. Si no se pasa un cliente ya armado (tests, o el endpoint del botón
    manual que ya tiene el suyo), arma uno de service_role propio -- así el scheduler de devops
    puede invocar esta función directo (fecha) sin pasar por FastAPI Depends. Una persona que
    revienta no detiene a las demás (SCJ-PRO-14 §V): se captura por persona y sigue con las
    siguientes."""
    if db is None:
        db = get_service_client(get_settings())

    fecha_iso = fecha.isoformat()
    corrida = _upsert_corrida_en_progreso(db, fecha_iso)

    creados = 0
    ya_existian = 0
    errores: list[str] = []

    for persona_id in _personas_de_confianza_vigentes(db, fecha_iso):
        try:
            if _crear_dia_si_no_existe(db, persona_id, fecha_iso):
                creados += 1
            else:
                ya_existian += 1
        except Exception as error:  # noqa: BLE001 -- por diseño: aislar la falla de una persona
            errores.append(f"{persona_id}: {error}")

    if errores:
        # RLS de corrida_batch sólo exige fn_caller_activo(), sin permiso específico (a
        # propósito) -- detalle no debe llevar persona_id crudo. El detalle completo (con
        # persona_id) va al log del servidor, no a la fila.
        logger.error("batch de_confianza fecha=%s errores=%s", fecha_iso, errores)
        detalle = (
            f"{creados} día(s) creado(s), {ya_existian} ya existían, "
            f"{len(errores)} error(es) -- ver logs del servidor."
        )
        estado_final = "fallida"
    else:
        detalle = f"{creados} día(s) creado(s), {ya_existian} ya existían."
        estado_final = "exitosa"

    return (
        db.postgrest.schema("tiempo")
        .table("corrida_batch")
        .update(
            {
                "estado": estado_final,
                "terminado_en": datetime.now(timezone.utc).isoformat(),
                "detalle": detalle,
            }
        )
        .eq("id", corrida["id"])
        .execute()
        .data[0]
    )

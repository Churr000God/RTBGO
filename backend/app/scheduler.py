"""Orquestación de los jobs programados de los batches del subsistema Tiempo (SCJ-PRO-12/13/14) --
arranca/apaga un BackgroundScheduler de APScheduler en el lifespan de FastAPI (app/main.py).

Llama cada función de batch directo en Python, NO vía HTTP interno -- un job de sistema no debe
pasar por el gate de permisos pensado para callers humanos (confirmado con security).

de_confianza y cierre_dia corren TODOS los días a la MISMA hora (tiempo.parametro.
hora_corrida_cierre_dia) -- SCJ-PRO-14 lo documenta explícitamente como "mismo colchón/hora que
SCJ-PRO-12", no es casualidad ni un parámetro nuevo por batch. corte_quincenal reusa la MISMA
hora (no existe un parámetro propio en el catálogo -- revisado, sólo están hora_corte_dia y
hora_corrida_cierre_dia; corte_quincenal necesita correr después de que cierre_dia ya haya
procesado el último día del periodo, así que reusar el mismo colchón es razonable), pero sólo
dispara los días 1 y 16 de cada mes (SCJ-PRO-13 §III)."""

from contextlib import asynccontextmanager
from datetime import date

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI

from app.batches.cierre_dia import ejecutar_cierre_dia
from app.batches.corte_quincenal import ejecutar_corte_quincenal
from app.batches.de_confianza import ejecutar_batch_de_confianza
from app.config import get_settings
from app.deps import get_service_client

ID_JOB_BATCH_DE_CONFIANZA = "batch_de_confianza_diario"
ID_JOB_CIERRE_DIA = "cierre_dia_diario"
ID_JOB_CORTE_QUINCENAL = "corte_quincenal_dia_1_y_16"
HORA_POR_DEFECTO = (3, 0)  # mismo valor de ejemplo que db/ddl/03_parametros_ejemplo.sql


def _leer_hora_corrida_cierre_dia() -> tuple[int, int]:
    """tiempo.parametro.hora_corrida_cierre_dia -- compartida por los 3 batches
    (bitacora/2026-09-05_proceso_batch_confianza.md). Se lee una sola vez al arrancar el
    proceso, no hay reconfiguración en caliente todavía. Si Supabase no responde en ese momento,
    cae al valor de ejemplo sembrado en vez de tumbar el arranque del backend entero por un
    problema transitorio de red."""
    try:
        db = get_service_client(get_settings())
        hoy = date.today().isoformat()
        filas = (
            db.postgrest.schema("tiempo")
            .table("parametro")
            .select("valor")
            .eq("clave", "hora_corrida_cierre_dia")
            .lte("vigente_desde", hoy)
            .order("vigente_desde", desc=True)
            .limit(1)
            .execute()
            .data
        )
        if not filas:
            return HORA_POR_DEFECTO
        hora_str, minuto_str = filas[0]["valor"].split(":")
        return int(hora_str), int(minuto_str)
    except Exception:
        return HORA_POR_DEFECTO


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = BackgroundScheduler()
    hora, minuto = _leer_hora_corrida_cierre_dia()
    scheduler.add_job(
        lambda: ejecutar_batch_de_confianza(date.today()),
        trigger="cron",
        hour=hora,
        minute=minuto,
        id=ID_JOB_BATCH_DE_CONFIANZA,
        replace_existing=True,
    )
    scheduler.add_job(
        lambda: ejecutar_cierre_dia(date.today()),
        trigger="cron",
        hour=hora,
        minute=minuto,
        id=ID_JOB_CIERRE_DIA,
        replace_existing=True,
    )
    scheduler.add_job(
        lambda: ejecutar_corte_quincenal(date.today()),
        trigger="cron",
        day="1,16",
        hour=hora,
        minute=minuto,
        id=ID_JOB_CORTE_QUINCENAL,
        replace_existing=True,
    )
    scheduler.start()
    app.state.scheduler = scheduler
    try:
        yield
    finally:
        scheduler.shutdown()

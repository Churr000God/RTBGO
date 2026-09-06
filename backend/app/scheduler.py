"""Orquestación del job programado del batch de_confianza (SCJ-PRO-14) -- arranca/apaga un
BackgroundScheduler de APScheduler en el lifespan de FastAPI (app/main.py).

Llama ejecutar_batch_de_confianza directo en Python, NO vía HTTP interno -- un job de sistema no
debe pasar por el gate de permisos pensado para callers humanos (confirmado con security)."""

from contextlib import asynccontextmanager
from datetime import date

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI

from app.batches.de_confianza import ejecutar_batch_de_confianza
from app.config import get_settings
from app.deps import get_service_client

ID_JOB_BATCH_DE_CONFIANZA = "batch_de_confianza_diario"
HORA_POR_DEFECTO = (3, 0)  # mismo valor de ejemplo que db/ddl/03_parametros_ejemplo.sql


def _leer_hora_corrida_de_confianza() -> tuple[int, int]:
    """tiempo.parametro.hora_corrida_cierre_dia -- SCJ-PRO-14 reusa "el mismo colchón/hora que
    SCJ-PRO-12" (bitacora/2026-09-05_proceso_batch_confianza.md). Se lee una sola vez al
    arrancar el proceso, no hay reconfiguración en caliente todavía. Si Supabase no responde en
    ese momento, cae al valor de ejemplo sembrado en vez de tumbar el arranque del backend
    entero por un problema transitorio de red."""
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
    hora, minuto = _leer_hora_corrida_de_confianza()
    scheduler.add_job(
        lambda: ejecutar_batch_de_confianza(date.today()),
        trigger="cron",
        hour=hora,
        minute=minuto,
        id=ID_JOB_BATCH_DE_CONFIANZA,
        replace_existing=True,
    )
    scheduler.start()
    app.state.scheduler = scheduler
    try:
        yield
    finally:
        scheduler.shutdown()

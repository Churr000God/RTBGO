"""API de tiempo.banco_de_horas / tiempo.movimiento_de_saldo -- SCJ-DEC-02/SCJ-PRO-13.
monto/vivo_desde de tiempo.banco_de_horas son materializados por trigger
(fn_movimiento_de_saldo_actualiza_banco), nadie los edita a mano -- este router sigue siendo de
sólo lectura.

Este corte suma el desglose de antigüedad del saldo (0-3/3-6/6+ meses, derivado de
ventana_banco_meses) reconstruido en memoria desde el ledger tiempo.movimiento_de_saldo
(app/banco_antiguedad.py) -- sin migración nueva, vivo_desde no alcanza para distinguir horas
viejas de horas nuevas dentro de la misma persona.

Cambio de postura respecto del corte anterior: de get_caller_client a get_service_client para el
dato, sumando el gate explícito del ledger. Con get_caller_client, alguien con
banco_de_horas_lectura pero SIN permiso sobre el ledger vería `[]` de movimientos y toda la
antigüedad en cero SIN error -- falla silenciosa. Con service_role + los dos permisos exigidos
explícitamente (AND entre grupos, OR dentro de cada uno), la autorización es real y visible,
mismo patrón que tramos.py/dias.py.

**Filtro/orden/paginación de tramo_antiguedad se hacen EN MEMORIA** (a diferencia de
busqueda_persona, que sigue resolviéndose server-side contra personas.persona): el desglose no es
una columna real de tiempo.banco_de_horas, se deriva del ledger completo -- no hay forma de
pedirle a PostgREST un `.range()`/`.order()` sobre algo que no existe como columna. Se trae la
tabla de saldos completa + los movimientos de quienes tienen monto > 0, se calcula FIFO una vez, y
recién ahí se filtra/ordena/pagina. Volumen esperado bajo (2 movimientos/persona/mes) -- no
justifica una vista materializada todavía. El `resumen` (métricas globales + top-8 en deuda)
se calcula sobre TODAS las personas, antes de aplicar busqueda_persona/tramo_antiguedad -- son
"la foto completa del banco", no deberían cambiar porque alguien filtró la tabla."""

from datetime import date, datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Query
from supabase import Client

from app.banco_antiguedad import (
    ResultadoAntiguedad,
    calcular_antiguedad_saldo,
    calcular_lotes,
    resolver_ventana_meses,
)
from app.deps import get_service_client
from app.permisos import requiere_permiso
from app.schemas.banco_de_horas import BancoDeHorasListaOut, MovimientoSaldoListaOut

router = APIRouter(prefix="/api/banco-de-horas", tags=["banco-de-horas"])

LIMITE_DEFECTO = 50
LIMITE_MAXIMO = 200

TOP_EN_DEUDA_CANTIDAD = 8

ORDEN_A_CLAVE = {
    "monto_desc": (lambda item: item["monto"], True),
    "monto_asc": (lambda item: item["monto"], False),
    "antiguedad_desc": (lambda item: item["meses_antiguedad_max"], True),
    "antiguedad_asc": (lambda item: item["meses_antiguedad_max"], False),
}


def _resolver_ids_por_busqueda(db: Client, busqueda: str) -> list[str]:
    """Mismo molde que tramos.py/dias.py::_resolver_ids_por_busqueda."""
    filtro = f"primer_nombre.ilike.%{busqueda}%,apellido_paterno.ilike.%{busqueda}%,apellido_materno.ilike.%{busqueda}%"
    filas = (
        db.postgrest.schema("personas")
        .table("persona")
        .select("id")
        .or_(filtro)
        .execute()
        .data
    )
    return [fila["id"] for fila in filas]


def _resolver_nombres_persona(db: Client, persona_ids: list[str]) -> dict[str, str]:
    if not persona_ids:
        return {}
    filas = (
        db.postgrest.schema("personas")
        .table("persona")
        .select("id, primer_nombre, apellido_paterno")
        .in_("id", persona_ids)
        .execute()
        .data
    )
    return {fila["id"]: f"{fila['primer_nombre']} {fila['apellido_paterno']}" for fila in filas}


def _resolver_movimientos_por_banco(db: Client, banco_ids: list[int]) -> dict[int, list[dict]]:
    """Sólo de bancos con monto > 0 -- quien no debe nada no tiene lotes que reconstruir
    (calcular_antiguedad_saldo ya corta ese caso antes de necesitar el ledger)."""
    if not banco_ids:
        return {}
    filas = (
        db.postgrest.schema("tiempo")
        .table("movimiento_de_saldo")
        .select("id, banco_de_horas_id, creado_en, monto")
        .in_("banco_de_horas_id", banco_ids)
        .execute()
        .data
    )
    por_banco: dict[int, list[dict]] = {}
    for fila in filas:
        por_banco.setdefault(fila["banco_de_horas_id"], []).append(fila)
    return por_banco


def _resultado_a_dict(resultado: ResultadoAntiguedad) -> dict:
    return {
        "horas_reciente": resultado.horas_reciente,
        "horas_media": resultado.horas_media,
        "horas_fuera_ventana": resultado.horas_fuera_ventana,
        "meses_antiguedad_max": resultado.meses_antiguedad_max,
        "conciliado": resultado.conciliado,
    }


def _armar_saldos_completos(db_servicio: Client, hoy: datetime) -> tuple[list[dict], int]:
    """Toda la tabla banco_de_horas, enriquecida con nombre + desglose de antigüedad -- base
    tanto del `resumen` como de `saldos` (filtrado/ordenado/paginado después, en memoria)."""
    ventana_meses = resolver_ventana_meses(db_servicio, date.today().isoformat())
    filas = (
        db_servicio.postgrest.schema("tiempo")
        .table("banco_de_horas")
        .select("id, persona_id, monto, vivo_desde, actualizado_en")
        .execute()
        .data
    )
    if not filas:
        return [], ventana_meses

    banco_ids_con_deuda = [fila["id"] for fila in filas if float(fila["monto"]) > 0]
    movimientos_por_banco = _resolver_movimientos_por_banco(db_servicio, banco_ids_con_deuda)
    nombres = _resolver_nombres_persona(db_servicio, [fila["persona_id"] for fila in filas])

    saldos: list[dict] = []
    for fila in filas:
        vivo_desde = (
            datetime.fromisoformat(fila["vivo_desde"]) if fila["vivo_desde"] is not None else None
        )
        resultado = calcular_antiguedad_saldo(
            movimientos_por_banco.get(fila["id"], []),
            float(fila["monto"]),
            vivo_desde,
            ventana_meses,
            hoy,
        )
        saldos.append(
            {
                "persona_id": fila["persona_id"],
                "persona_nombre": nombres.get(fila["persona_id"]),
                "monto": float(fila["monto"]),
                "vivo_desde": fila["vivo_desde"],
                "actualizado_en": fila["actualizado_en"],
                **_resultado_a_dict(resultado),
            }
        )
    return saldos, ventana_meses


def _armar_resumen(saldos_completos: list[dict], ventana_meses: int) -> dict:
    en_deuda = [item for item in saldos_completos if item["monto"] > 0]
    fuera_ventana = [item for item in saldos_completos if item["horas_fuera_ventana"] > 0]
    top = sorted(en_deuda, key=lambda item: item["monto"], reverse=True)[:TOP_EN_DEUDA_CANTIDAD]
    return {
        "total_personas": len(saldos_completos),
        "en_deuda": len(en_deuda),
        "sin_deuda": len(saldos_completos) - len(en_deuda),
        "horas_adeudadas": round(sum(item["monto"] for item in en_deuda), 2),
        "horas_fuera_ventana": round(sum(item["horas_fuera_ventana"] for item in fuera_ventana), 2),
        "personas_fuera_ventana": len(fuera_ventana),
        "ventana_meses": ventana_meses,
        "top_en_deuda": [
            {
                "persona_id": item["persona_id"],
                "persona_nombre": item["persona_nombre"],
                "monto": item["monto"],
                "meses_antiguedad_max": item["meses_antiguedad_max"],
            }
            for item in top
        ],
    }


@router.get("", response_model=BancoDeHorasListaOut)
def listar_banco_de_horas(
    db_servicio: Client = Depends(get_service_client),
    _permiso_banco: None = Depends(requiere_permiso("banco_de_horas_lectura")),
    _permiso_ledger: None = Depends(
        requiere_permiso("movimiento_de_saldo_lectura", "movimiento_de_saldo_edicion")
    ),
    busqueda_persona: str | None = Query(None, description="Texto libre sobre el nombre."),
    tramo_antiguedad: Literal["reciente", "media", "fuera_ventana"] | None = Query(None),
    orden: Literal["monto_desc", "monto_asc", "antiguedad_desc", "antiguedad_asc"] = Query(
        "monto_desc"
    ),
    limite: int = Query(LIMITE_DEFECTO, ge=1, le=LIMITE_MAXIMO),
    desplazamiento: int = Query(0, ge=0),
) -> dict:
    hoy = datetime.now(timezone.utc)
    saldos_completos, ventana_meses = _armar_saldos_completos(db_servicio, hoy)
    resumen = _armar_resumen(saldos_completos, ventana_meses)

    filtrados = saldos_completos
    if busqueda_persona is not None:
        persona_ids = set(_resolver_ids_por_busqueda(db_servicio, busqueda_persona))
        filtrados = [item for item in filtrados if item["persona_id"] in persona_ids]

    campo_tramo = {
        "reciente": "horas_reciente",
        "media": "horas_media",
        "fuera_ventana": "horas_fuera_ventana",
    }
    if tramo_antiguedad is not None:
        filtrados = [item for item in filtrados if item[campo_tramo[tramo_antiguedad]] > 0]

    clave, descendente = ORDEN_A_CLAVE[orden]
    filtrados = sorted(filtrados, key=clave, reverse=descendente)

    total = len(filtrados)
    saldos = filtrados[desplazamiento : desplazamiento + limite]
    return {"total": total, "resumen": resumen, "saldos": saldos}


@router.get("/{persona_id}/movimientos", response_model=MovimientoSaldoListaOut)
def listar_movimientos_de_persona(
    persona_id: str,
    db_servicio: Client = Depends(get_service_client),
    _permiso_banco: None = Depends(requiere_permiso("banco_de_horas_lectura")),
    _permiso_ledger: None = Depends(
        requiere_permiso("movimiento_de_saldo_lectura", "movimiento_de_saldo_edicion")
    ),
) -> dict:
    """Ledger completo de una persona -- más reciente primero (mismo criterio que marcas.py).
    saldo_corrido es el acumulado hasta ese movimiento (incluido). vivo indica si ese movimiento
    todavía tiene lote sin consumir (reusa calcular_lotes, no una cuenta aparte)."""
    banco = (
        db_servicio.postgrest.schema("tiempo")
        .table("banco_de_horas")
        .select("id")
        .eq("persona_id", persona_id)
        .execute()
        .data
    )
    if not banco:
        return {"total": 0, "movimientos": []}

    banco_id = banco[0]["id"]
    filas = (
        db_servicio.postgrest.schema("tiempo")
        .table("movimiento_de_saldo")
        .select("id, tipo, monto, motivo, autor_id, creado_en")
        .eq("banco_de_horas_id", banco_id)
        .execute()
        .data
    )
    if not filas:
        return {"total": 0, "movimientos": []}

    ordenadas_asc = sorted(filas, key=lambda fila: (fila["creado_en"], fila["id"]))
    lotes_vivos = calcular_lotes(ordenadas_asc)
    ids_vivos = {lote.movimiento_id for lote in lotes_vivos}

    saldo_corrido = 0.0
    saldo_por_id: dict[int, float] = {}
    for fila in ordenadas_asc:
        saldo_corrido = round(saldo_corrido + float(fila["monto"]), 2)
        saldo_por_id[fila["id"]] = saldo_corrido

    autor_ids = sorted({fila["autor_id"] for fila in filas if fila["autor_id"] is not None})
    nombres_autor = _resolver_nombres_persona(db_servicio, autor_ids)

    movimientos = [
        {
            "id": fila["id"],
            "creado_en": fila["creado_en"],
            "tipo": fila["tipo"],
            "monto": float(fila["monto"]),
            "motivo": fila["motivo"],
            "autor_nombre": nombres_autor.get(fila["autor_id"]) if fila["autor_id"] else None,
            "saldo_corrido": saldo_por_id[fila["id"]],
            "vivo": fila["id"] in ids_vivos,
        }
        for fila in sorted(filas, key=lambda fila: fila["creado_en"], reverse=True)
    ]
    return {"total": len(movimientos), "movimientos": movimientos}

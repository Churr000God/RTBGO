"""Catálogo cerrado de las 8 claves de tiempo.parametro (SCJ-DIC-01 §IV). Vive en código, no en
columnas nuevas de la tabla -- el usuario no quiere alta/baja de claves desde la pantalla (el
catálogo lo define el código, no el dato), el campo `tipo` alimenta la validación Pydantic de
schemas/parametros.py, y columnas nuevas duplicarían lo que ya está documentado en el
diccionario de datos.

`impacta_logica=True` sólo en las 5 claves que algún router/batch lee hoy (confirmado por grep):
tolerancia_retardo_min (alertas_de_retardo.py), dias_habiles_correccion_marca
(correcciones.py), hora_corrida_cierre_dia (scheduler.py), descuento_pausa_no_registrada_min
(batches/cierre_dia.py) y ventana_banco_meses (app/banco_antiguedad.py::resolver_ventana_meses).
Las otras 3 están sembradas pero ningún código las consume -- la pantalla lo marca con un badge
en vez de esconderlo."""

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class EntradaParametro:
    etiqueta: str
    descripcion: str
    tipo: Literal["entero", "hora"]
    unidad: str | None
    impacta_logica: bool
    nota: str | None = None


CATALOGO: dict[str, EntradaParametro] = {
    "tolerancia_retardo_min": EntradaParametro(
        etiqueta="Tolerancia de retardo",
        descripcion="Minutos antes de considerar retardo.",
        tipo="entero",
        unidad="min",
        impacta_logica=True,
    ),
    "hora_corte_dia": EntradaParametro(
        etiqueta="Hora de corte de día",
        descripcion="A qué hora se considera cerrado un día.",
        tipo="hora",
        unidad=None,
        impacta_logica=False,
    ),
    "ventana_banco_meses": EntradaParametro(
        etiqueta="Ventana del banco de horas",
        descripcion="Duración de la ventana de resolución del banco de horas.",
        tipo="entero",
        unidad="meses",
        impacta_logica=True,
    ),
    "umbral_aviso_pct": EntradaParametro(
        etiqueta="Umbral de aviso",
        descripcion="Porcentaje de la jornada semanal para avisar.",
        tipo="entero",
        unidad="%",
        impacta_logica=False,
    ),
    "umbral_escalamiento_pct": EntradaParametro(
        etiqueta="Umbral de escalamiento",
        descripcion="Porcentaje de la jornada semanal para escalar.",
        tipo="entero",
        unidad="%",
        impacta_logica=False,
    ),
    "descuento_pausa_no_registrada_min": EntradaParametro(
        etiqueta="Descuento por pausa no registrada",
        descripcion="Descuento fijo cuando la pausa no se marca.",
        tipo="entero",
        unidad="min",
        impacta_logica=True,
    ),
    "dias_habiles_correccion_marca": EntradaParametro(
        etiqueta="Días hábiles para corrección de marca",
        descripcion="Ventana para corregir una marca, contada en días hábiles.",
        tipo="entero",
        unidad="días hábiles",
        impacta_logica=True,
    ),
    "hora_corrida_cierre_dia": EntradaParametro(
        etiqueta="Hora de corrida de cierre de día",
        descripcion=(
            "Colchón tras la hora de corte de día antes de correr el batch de cierre, para dar "
            "tiempo a que sincronicen los terminales."
        ),
        tipo="hora",
        unidad=None,
        impacta_logica=True,
        nota="Requiere reiniciar el backend para tomar efecto -- el scheduler la lee una sola vez al arrancar.",
    ),
}

# Modelo lógico — Subsistema de Tiempo

**Sistema de Control de Jornada**
Folio SCJ-MOD-02 · Versión 1.0 · 28 de agosto de 2026

Entidades, atributos, claves y cardinalidades del subsistema de Tiempo. Entregable E2 de
`SCJ-ESP-01`. La justificación de normalización va aparte, en `SCJ-NRM-01`.

---

## I. Diagrama

> Fuente en `diagramas/fuente/logico.mmd` · Imagen en `diagramas/export/logico.svg`

---

## II. Entidades

### II.1 `persona` *(stub)*

Ancla de claves foráneas. Una sola columna. Ver `SCJ-FRO-01`.

| Atributo | Tipo | Clave | Nulo | Descripción |
|---|---|---|---|---|
| `id` | bigint | PK | No | Identificador opaco |

### II.2 `marca`

*Evento crudo producido por el terminal. **Inmutable.** Ver `SCJ-CDT-01`.*

| Atributo | Tipo | Clave | Nulo | Descripción |
|---|---|---|---|---|
| | | | | |

**Restricciones:**
- `uq_marca_terminal_secuencia` — idempotencia del envío por lotes
- *(completar)*

### II.3 `tramo`

*Par de marcas: la impar abre, la par cierra. Ver `SCJ-ESP-01 §VI.1`.*

| Atributo | Tipo | Clave | Nulo | Descripción |
|---|---|---|---|---|
| | | | | |

### II.4 `jornada_asignada`

*Jornada de una persona **con vigencia**. Ver `SCJ-ESP-01 §VI.3`.*

| Atributo | Tipo | Clave | Nulo | Descripción |
|---|---|---|---|---|
| | | | | |

### II.5 `patron_semanal` / `bloque_de_jornada`

*Qué días se trabaja, con qué horario y con qué bloques. Debe admitir jornada partida.*

### II.6 `tope_legal`

*Máximo semanal por vigencia. Ver `SCJ-ESP-01 §VI.4`.*

### II.7 `banco_de_horas` y `movimiento_de_saldo`

*Deuda, ventana de resolución y las cuatro salidas. Ver `SCJ-ESP-01 §VI.6` y `SCJ-DEC-02`.*

### II.8 `correccion`

*Registro nuevo que apunta al original. Ver `SCJ-ESP-01 §VI.7` y `SCJ-DEC-03`.*

### II.9 `ausencia`, `tipo_de_ausencia` y `paso_de_autorizacion`

*Ver `SCJ-ESP-01 §VI.8` y `SCJ-DEC-05`.*

### II.10 `parametro`

*Toda regla de negocio vive aquí. Ver `SCJ-ESP-01 §VI.9`.*

### II.11 `excepcion`

*Cola de revisión humana: días impares, relojes desincronizados, saldos vencidos.*

---

## III. Cardinalidades

| Relación | Cardinalidad | Comentario |
|---|---|---|
| | | |

---

## IV. Restricciones que el modelo debe sostener

Las cuatro más exigentes, con la estructura que las garantiza:

| # | Restricción | Cómo se sostiene | Decisión |
|---|---|---|---|
| 1 | Paridad de marcas por día | | `SCJ-DEC-01` |
| 2 | Un cálculo pasado da el mismo resultado indefinidamente | | `SCJ-DEC-04` |
| 3 | Una marca nunca se modifica | | `SCJ-DEC-03` |
| 4 | Los topes cambian por año sin alterar el histórico | | `SCJ-DEC-04` |

---

## V. Lo que quedó fuera del modelo, a propósito

| Qué | Por qué |
|---|---|
| | |

---

*Modelo lógico · Folio SCJ-MOD-02 · V1.0*

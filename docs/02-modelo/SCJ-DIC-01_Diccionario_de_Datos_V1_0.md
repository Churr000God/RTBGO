# Diccionario de datos

**Sistema de Control de Jornada · Esquema `tiempo`**
Folio SCJ-DIC-01 · Versión 1.0 · 25 de septiembre de 2026

Cada tabla, cada columna, su tipo, su dominio y su propósito. Se cierra con el congelamiento del
esquema.

> **Se genera parcialmente desde la base.** Ver `tools/generar_diccionario.sql`. Los comentarios de
> `COMMENT ON` del DDL son la fuente; este documento los presenta.

---

## I. Resumen del esquema

| Tabla | Filas esperadas (6 meses, 8 personas) | Propósito |
|---|---|---|
| `persona` | 8 | Stub de la frontera |
| `marca` | ~5,800 | Eventos crudos del terminal |
| `tramo` | ~2,900 | Pares de marcas |
| `jornada_asignada` | ~15 | Vigencias de jornada |
| `banco_de_horas` | | Saldos |
| `ausencia` | ~60 | |
| `parametro` | ~20 | |
| `excepcion` | | |

---

## II. Tablas

### `tiempo.persona`

> Stub. Identificador opaco. Ningún atributo de identidad. Ver `SCJ-FRO-01`.

| Columna | Tipo | Nulo | Predeterminado | Dominio | Descripción |
|---|---|---|---|---|---|
| `id` | `bigint` | No | — | > 0 | Identificador opaco de la persona |

**Claves:** PK `id`
**Índices:** —
**Referenciada por:** `marca`, `jornada_asignada`, `ausencia`, `banco_de_horas`

---

### `tiempo.marca`

| Columna | Tipo | Nulo | Predeterminado | Dominio | Descripción |
|---|---|---|---|---|---|
| | | | | | |

**Claves:** · **Restricciones:** · **Índices:** · **Referenciada por:**

---

*(una sección por tabla)*

---

## III. Enumerados

| Enumerado | Valores | Usado en |
|---|---|---|
| `origen_marca` | `terminal`, `contingencia`, `captura_manual` | `marca.origen` |
| `tipo_de_tiempo` | `ordinario`, `reposicion`, `extra` | |
| `tipo_de_ausencia` | `vacaciones`, `permiso_con_goce`, `permiso_sin_goce`, `incapacidad`, `falta` | |
| `salida_de_saldo` | `cubrir`, `arrastrar`, `descontar`, `condonar` | |

---

## IV. Parámetros del sistema

Todos los valores son **de ejemplo**. Ver `SCJ-ESP-01 §VI.9`.

| Clave | Tipo | Valor de ejemplo | Qué controla |
|---|---|---|---|
| `tolerancia_retardo_min` | entero | 10 | Minutos antes de considerar retardo |
| `hora_corte_dia` | hora | 03:00 | A qué hora se considera cerrado un día |
| `ventana_banco_meses` | entero | 6 | Duración de la ventana de resolución |
| `umbral_aviso_pct` | entero | 100 | Porcentaje de la jornada semanal para avisar |
| `umbral_escalamiento_pct` | entero | 200 | Porcentaje para escalar |
| `descuento_pausa_no_registrada_min` | entero | 60 | Descuento fijo cuando la pausa no se marca |

---

*Diccionario de datos · Folio SCJ-DIC-01 · V1.0*

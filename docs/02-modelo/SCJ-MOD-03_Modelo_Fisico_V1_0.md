# Modelo físico — Subsistema de Tiempo

**Sistema de Control de Jornada · PostgreSQL 16**
Folio SCJ-MOD-03 · Versión 1.0 · 4 de septiembre de 2026

Correspondencia entre el modelo lógico y el DDL: tipos elegidos, restricciones activas y su
justificación. Entregable E3 de `SCJ-ESP-01`.

> **Este documento no repite el DDL.** El DDL vive en `db/ddl/` y es la fuente de verdad. Aquí se
> explica **por qué** es como es.

---

## I. Organización de los archivos

| Archivo | Contenido |
|---|---|
| `db/ddl/00_esquemas.sql` | Esquemas `personas` y `tiempo`, extensiones |
| `db/ddl/01_persona_stub.sql` | El stub de la frontera |
| `db/ddl/02_tiempo.sql` | Tablas del subsistema de Tiempo |
| `db/ddl/03_parametros_ejemplo.sql` | Parámetros con **valores de ejemplo** |
| `db/indices/01_indices.sql` | Índices, con su justificación en `SCJ-IDX-01` |

---

## II. Extensiones requeridas

| Extensión | Para qué |
|---|---|
| `btree_gist` | Restricciones de exclusión sobre vigencias que combinan `persona_id` con un rango |

---

## III. Decisiones de tipo

| Concepto | Tipo elegido | Alternativa descartada | Por qué |
|---|---|---|---|
| Instantes | `timestamptz` | `timestamp` | Sin zona no se puede razonar sobre el cambio de horario |
| Vigencias | `daterange` | Dos columnas de fecha | Permite exclusión declarativa de traslapes |
| Duraciones | | | |
| Enumerados | | `text` con `CHECK` | |
| Identificadores | | | |

---

## IV. Restricciones activas

Las que se implementan en la base y no en la aplicación, con la decisión que lo justifica.

| Restricción | Tabla | Tipo | Decisión |
|---|---|---|---|
| Paridad de marcas por día | `marca` | | `SCJ-DEC-01` |
| Idempotencia terminal + secuencia | `marca` | `UNIQUE` | `SCJ-CDT-01 §VIII` |
| Inmutabilidad de la marca | `marca` | | `SCJ-DEC-03` |
| No traslape de vigencias | `jornada_asignada` | `EXCLUDE` | `SCJ-DEC-04` |
| | | | |

---

## V. Dónde se decidió **no** poner la regla en la base

Tan importante como lo anterior. Cada renglón necesita un porqué.

| Regla | Dónde vive | Por qué no en la base |
|---|---|---|
| | | |

---

## VI. Diferencias respecto del modelo lógico

Lo que cambió al implementar. **Cada cambio con su motivo**, y la decisión correspondiente
actualizada.

| Qué cambió | Por qué | Documento actualizado |
|---|---|---|
| | | |

---

*Modelo físico · Folio SCJ-MOD-03 · V1.0*

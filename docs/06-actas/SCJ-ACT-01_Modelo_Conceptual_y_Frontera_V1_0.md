# Acta — Modelo conceptual y acuerdo de frontera

**Sistema de Control de Jornada**
Folio SCJ-ACT-01 · Versión 1.0 (borrador) · 22 de agosto de 2026

Sesión conjunta de diseño. Corresponde a las tareas J1.1 y J1.2 del plan.

> **Estado: borrador pendiente de sesión conjunta.** Lo que sigue es la preparación de Diego,
> hecha en solitario el 29 de agosto (ver `bitacora/2026-08-22_J1.1_sesion_modelo_conceptual.md`),
> con `SCJ-MOD-01` y `SCJ-FRO-01 V1.1` ya redactados. **Falta la sesión real con el compañero del
> subsistema de Personas** para validar, discutir desacuerdos y firmar el §VII. Nada de este
> documento cierra J1.1/J1.2 hasta esa firma.

---

## I. Datos de la sesión

| | |
|---|---|
| Fecha | *(pendiente — fecha de la sesión conjunta real)* |
| Duración | |
| Participantes | Subsistema de Personas · Subsistema de Tiempo |
| Modalidad | |

---

## II. Agenda cubierta

| # | Punto | ¿Se cubrió? |
|---|---|---|
| 1 | Presentación de las entidades del subsistema de Personas, como cajas con atributos | **No.** La silueta de `SCJ-MOD-01 §III` es una propuesta de Diego por analogía, no confirmada por quien diseña Personas |
| 2 | Presentación de la lectura del subsistema de Tiempo a partir de `SCJ-ESP-01` | Sí, en la preparación del 29 de agosto |
| 3 | Dibujo del diagrama completo entre ambos | Borrador listo (`SCJ-MOD-01`, `diagramas/fuente/conceptual.mmd`, exportado a `diagramas/export/conceptual.svg`); falta validación conjunta |
| 4 | Identificación de las relaciones que cruzan la frontera | Sí — una sola relación, `PERSONA ||--|| PERSONA_STUB`, con `persona_id` y la excepción `fecha_ingreso` (`SCJ-FRO-01 §V`) |
| 5 | Registro de desacuerdos y preguntas abiertas | Sin desacuerdos que registrar aún — no ha habido sesión conjunta donde puedan surgir |

---

## III. Qué se acordó

*(Preparado por Diego en solitario — pendiente de que el compañero de Personas lo revise y lo
acuerde en sesión. No es un acuerdo conjunto todavía.)*

- `fecha_ingreso` se replica en `tiempo.persona`, de sólo lectura, como única excepción a la regla
  de frontera del §I de `SCJ-FRO-01`. `SCJ-FRO-01` sube a V1.1
- Entidades de Personas (silueta conceptual, propuesta): `persona`, `expediente`, `puesto`,
  `usuario`, `permiso`, `asignacion` — atributos principales en `SCJ-MOD-01 §III`
- Entidades de Tiempo (14, confirmadas contra `SCJ-ESP-01 §III.1`): atributos principales en
  `SCJ-MOD-01 §IV`
- Diagrama conceptual completo, con la frontera marcada como única línea que cruza

---

## IV. Desacuerdos

Lo que no quedó resuelto y cómo se va a resolver.

| # | Desacuerdo | Postura de cada lado | Cómo se resuelve | Para cuándo |
|---|---|---|---|---|
| | *(ninguno registrado — no ha ocurrido la sesión conjunta)* | | | |

---

## V. Preguntas abiertas levantadas

Se trasladan a `SCJ-PRA-01`. Ninguna nueva desde la preparación en solitario — la pregunta #01
(fecha de ingreso) pasó de abierta a resuelta.

| # | Pregunta | Bloquea a |
|---|---|---|
| | | |

---

## VI. Entregables de la sesión

| Entregable | Documento | Estado |
|---|---|---|
| Diagrama conceptual | `SCJ-MOD-01` | Redactado (V1.0), pendiente de validación conjunta |
| Contrato de frontera | `SCJ-FRO-01` | Redactado (V1.1), §V resuelto, pendiente de firma en §VI |
| Lista de preguntas abiertas | `SCJ-PRA-01` | Al día |

---

## VII. Aceptación

Ambos aceptan lo acordado en el §III y el contrato de frontera `SCJ-FRO-01`.

**No firmar hasta que la sesión conjunta real haya ocurrido y el §III refleje lo acordado entre
los dos, no solo la propuesta de Diego.**

| | Nombre | Fecha |
|---|---|---|
| Subsistema de Personas | | |
| Subsistema de Tiempo | | |

---

*Acta · Folio SCJ-ACT-01 · V1.0 (borrador)*

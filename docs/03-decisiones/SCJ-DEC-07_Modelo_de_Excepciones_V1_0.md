# SCJ-DEC-07 · ¿`requiere_revision` y `motivo_revision` viven como atributos de la marca, o como una entidad de excepción con ciclo de vida propio?

**Estado:** Propuesta
**Fecha de la decisión:** —
**Última revisión:** —

---

## Contexto

`SCJ-CDT-01 §V.1` fija dos campos en el contrato de la marca: `requiere_revision` (booleano) y
`motivo_revision` (uno de cinco valores: `reloj_no_sincronizado`, `plantilla_desconocida`,
`persona_inactiva`, `fuera_de_horario`, `dia_cerrado`). `SCJ-ESP-01 §VI.7.5` (la marca señalada y la
cola de excepciones) exige además que **la resolución de una excepción sea un registro nuevo**, con
motivo, autor y momento, que **no borra la señal original**.

No hay respuesta obvia porque el contrato ya entrega el motivo como un campo escalar de la marca —lo
más simple es dejarlo ahí—, pero el requisito de resolución auditable (quién la resolvió, cuándo, con
qué motivo) empieza a parecerse a una entidad con su propio historial, no a dos columnas.

---

## Opciones consideradas

### Opción A — Atributos en la marca

`marca.requiere_revision`, `marca.motivo_revision`, más columnas de resolución
(`resuelta_por`, `fecha_resolucion`, `motivo_resolucion`) en la misma fila.

**A favor:** espejo exacto del contrato de `SCJ-CDT-01`. Consultar "marcas pendientes de revisión"
es un filtro simple sobre `marca`. Nada que unir.
**En contra:** una marca sólo puede tener **un** motivo de señalamiento a la vez, aunque en teoría
podría entrar por `reloj_no_sincronizado` y, al procesarse, resultar además `fuera_de_horario`. La
resolución sobrescribe columnas de la misma fila — que raya con el principio de "nada se modifica"
(`SCJ-ESP-01 §V.1`) si la resolución se implementa como `UPDATE` en vez de como versión nueva.

### Opción B — Entidad `excepcion` con ciclo de vida propio

Tabla `excepcion(id, marca_id o dia_id, motivo, estado, creada_en, resuelta_por, motivo_resolucion,
resuelta_en)`. La marca sigue llevando `requiere_revision` como señal rápida, pero el detalle y la
historia de resolución viven aparte.

**A favor:** una marca puede acumular más de un motivo sin forzar el esquema. La resolución es un
**registro nuevo** por construcción — coherente con `§VI.7.5` y con el principio de inmutabilidad. La
cola de excepciones (`§VI.7.5`, "listarse por persona, por periodo y por motivo") es una consulta
directa sobre una tabla dedicada, sin tener que filtrar `marca` por un campo que también sirve para
otra cosa.
**En contra:** una tabla y una relación más. Para el caso simple —la inmensa mayoría, una marca con
cero o un motivo— es más estructura de la que hace falta.

---

## Decisión

*(pendiente)*

---

## Por qué

*(pendiente)*

---

## Consecuencias

*(pendiente)*

---

## Cómo se verifica

Una consulta que liste la cola de excepciones por persona, periodo y motivo (`SCJ-ESP-01 §VI.7.5`),
y que reconstruya, para una excepción resuelta, la señal original y su resolución sin que una haya
sobrescrito a la otra. Ver `SCJ-CVA-01`.

---

## Revisión posterior a la implementación

*(se llena al construir)*

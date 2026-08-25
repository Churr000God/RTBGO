# SCJ-DEC-02 · ¿El saldo del banco de horas se calcula al vuelo o se materializa?

**Estado:** Propuesta
**Fecha de la decisión:** —
**Última revisión:** —

---

## Contexto

`SCJ-ESP-01 §VI.6` exige que la deuda se salde dentro de una ventana configurable de seis meses,
con umbrales de alerta calculados como porcentaje de la jornada semanal de cada persona.

La consulta más exigente no es *"¿cuál es el saldo hoy?"* sino **"¿cuál era el saldo el 14 de
marzo?"** — porque de ahí sale la clasificación del tiempo entre reposición y extra
(`SCJ-ESP-01 §VI.5`), y esa clasificación debe poder recalcularse igual años después.

> El documento lo enuncia como pregunta abierta explícita: *"hay argumentos válidos de los dos
> lados"*.

---

## Opciones consideradas

### Opción A — Calcular al vuelo sobre las marcas

**A favor:** una sola fuente de verdad. El saldo nunca puede quedar inconsistente con las marcas
porque no existe por separado. Una corrección sobre una marca de marzo se propaga sola. Con 32
eventos diarios, el costo de recalcular seis meses es despreciable.
**En contra:** el cálculo depende de la jornada vigente en cada fecha, de los topes vigentes en cada
año y de las ausencias; es una consulta cara de escribir y difícil de leer. Y la clasificación de
tiempo depende del saldo **en el momento**, lo que introduce una recursión que hay que resolver con
cuidado.

### Opción B — Materializar el saldo y actualizarlo incrementalmente

**A favor:** consulta inmediata. La clasificación en reposición o extra se resuelve leyendo un
número. Los umbrales y alertas se evalúan sin recorrer el histórico.
**En contra:** dos fuentes de verdad. Una corrección sobre una marca vieja obliga a recalcular hacia
adelante, y si algo falla el saldo miente sin avisar. **Es el clásico caso donde el dato derivado
sobrevive al dato del que deriva.**

### Opción C — Libro de movimientos

Ni un total ni un recálculo: una tabla de **movimientos de saldo** —cargos por deuda, abonos por
reposición, cancelaciones por descuento o condonación— cada uno con su fecha, motivo y autor. El
saldo a cualquier fecha es la suma de los movimientos hasta esa fecha.

**A favor:** el saldo a una fecha pasada es una suma acotada, no un recálculo del mundo. Descontar y
condonar exigen motivo y autor permanentes (`§III.6`), y en este modelo eso es natural: son
movimientos, no cambios de un número. La corrección de una marca genera un movimiento de ajuste
visible, en lugar de reescribir la historia.
**En contra:** más tablas y más disciplina. Si un movimiento no se genera, el saldo queda mal y no
hay forma de detectarlo comparando con las marcas.

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

`db/consultas/validacion/02_saldo_a_fecha.sql` — saldo del banco de horas de una persona **a una
fecha dada del pasado**, ejecutado dos veces con meses de diferencia y con el mismo resultado.

---

## Revisión posterior a la implementación

*(se llena al construir)*

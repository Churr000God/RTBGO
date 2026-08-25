# SCJ-DEC-04 · ¿Cómo se representan las vigencias temporales y cómo se garantiza que no se traslapen?

**Estado:** Propuesta
**Fecha de la decisión:** —
**Última revisión:** —

---

## Contexto

Tres cosas del modelo tienen vigencia, y las tres por razones distintas:

| Qué | Vigencia | Requisito |
|---|---|---|
| **Jornada asignada** | Por persona, cambia cuando la empresa lo decide | `SCJ-ESP-01 §VI.3` |
| **Topes legales** | Global, cambia en fecha fija por ley | `SCJ-ESP-01 §VI.4` |
| **Tabla de vacaciones por antigüedad** | Global, configurable | `SCJ-ESP-01 §VI.8` |

**El requisito duro es el mismo para las tres:** un cálculo de un periodo pasado debe dar **el mismo
resultado indefinidamente**, aunque la jornada haya cambiado tres veces y el tope legal dos desde
entonces.

Y hay una segunda parte, más difícil que la primera: **garantizar que dos vigencias de la misma
persona no se traslapen**. Un día cubierto por dos jornadas distintas hace que el cálculo tenga dos
respuestas correctas.

---

## Opciones consideradas

### Opción A — Dos columnas de fecha, validado en la aplicación

`vigente_desde` y `vigente_hasta`, con `NULL` para la vigente.

**A favor:** simple, portable, legible en cualquier herramienta.
**En contra:** el traslape no lo impide nada. Basta una escritura por fuera para tener dos jornadas
activas el mismo día. La aritmética de bordes —¿`vigente_hasta` es inclusivo?— genera errores de un
día que nadie detecta hasta que aparecen en una nómina.

### Opción B — Tipo `daterange` con restricción de exclusión

```sql
EXCLUDE USING gist (persona_id WITH =, vigencia WITH &&)
```

**A favor:** **la base impide el traslape**, venga la escritura de donde venga. Los bordes quedan
explícitos en el tipo (`[)`), sin ambigüedad. Los operadores de rango hacen las consultas por fecha
mucho más legibles.
**En contra:** requiere `btree_gist`. Es específico de PostgreSQL, lo que en este proyecto no es un
problema pero conviene decirlo. Un rango abierto por la derecha necesita convención propia para "la
vigente".

### Opción C — Congelar el valor en el registro calculado

Además de la vigencia, cada día calculado guarda **la jornada que se le aplicó**. El histórico no
depende de poder reconstruir la vigencia.

**A favor:** la inmutabilidad del cálculo pasado queda garantizada aunque alguien corrija una
vigencia por error. Es la única opción que protege del error humano en los datos de vigencia.
**En contra:** desnormaliza. Duplica un dato que ya existe. Y si la corrección de la vigencia era
legítima, el histórico queda con el valor viejo — que es exactamente lo que se quería, pero hay que
poder explicarlo.

> **A y B no son excluyentes con C.** La combinación —rango con exclusión **más** valor congelado en
> el cálculo— es una respuesta legítima, y la desnormalización que implica se documenta en
> `SCJ-NRM-01 §III`.

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

- `db/consultas/validacion/03_calculo_historico.sql` — el mismo periodo calculado dos veces, con un
  cambio de jornada en medio, devolviendo lo mismo
- `db/consultas/validacion/04_tope_vigente.sql` — un cálculo de 2026 usando el tope de 48 h aunque
  el vigente sea el de 2028
- Intento de insertar una vigencia traslapada: debe fallar

---

## Revisión posterior a la implementación

*(se llena al construir)*

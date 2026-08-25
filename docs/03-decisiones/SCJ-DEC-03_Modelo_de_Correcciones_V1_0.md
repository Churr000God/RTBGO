# SCJ-DEC-03 · ¿Versionado, tabla de auditoría o registro de eventos para las correcciones?

**Estado:** Propuesta
**Fecha de la decisión:** —
**Última revisión:** —

---

## Contexto

`SCJ-ESP-01 §VI.7`: una marca registrada **nunca se modifica ni se elimina**. Una corrección es un
registro nuevo que apunta a la original, con el valor corregido, el motivo, el autor y el momento.

**El requisito duro:** debe poder reconstruirse el estado del registro **tal como era en cualquier
momento del pasado**, junto con la cadena completa de correcciones.

Y a partir de enero de 2027 esto deja de ser una preferencia de diseño: es lo que una autoridad
laboral puede exigir.

---

## Opciones consideradas

### Opción A — Versionado en la misma tabla

Cada corrección inserta una fila nueva con el mismo identificador lógico y un número de versión o un
rango de vigencia. La vigente es la última.

**A favor:** consultar el estado a una fecha es un filtro por rango, sin unir tablas. Todas las
versiones tienen la misma forma.
**En contra:** toda consulta ordinaria debe acordarse de filtrar por la versión vigente, y la que se
olvide devuelve filas duplicadas en silencio. Mezcla el dato original con sus correcciones en la
misma tabla, lo que hace más fácil violar la inmutabilidad por accidente.

### Opción B — Tabla de auditoría separada

La marca vive en su tabla y se modifica; un disparador copia el estado anterior a una tabla espejo.

**A favor:** patrón conocido, la tabla principal queda limpia y las consultas ordinarias no cambian.
**En contra:** **contradice el requisito.** La marca sí se modifica; la auditoría sólo guarda copia.
Si el disparador falla o alguien lo desactiva, el histórico se pierde sin dejar rastro. La
inmutabilidad pasa a depender de que nadie toque la base directamente.

### Opción C — Registro de eventos

La marca original se inserta una vez y nunca se toca. Cada corrección es un **evento** en una tabla
aparte que apunta a la marca y describe el cambio. El estado a una fecha se obtiene aplicando los
eventos hasta esa fecha sobre el original.

**A favor:** cumple el requisito de forma literal — la marca es inmutable por construcción, no por
convención. La cadena de correcciones es el dato, no un subproducto. Motivo y autor son atributos
naturales del evento.
**En contra:** el estado vigente no es una lectura directa; requiere una vista que aplique los
eventos, o un campo derivado que hay que mantener. Más caro de consultar y más difícil de explicar.

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

`db/consultas/validacion/05_reconstruccion_historica.sql` — **la consulta más exigente del
proyecto**: reconstruir el estado de un registro corregido tal como era en una fecha pasada, con la
cadena completa de correcciones aplicadas.

---

## Revisión posterior a la implementación

*(se llena al construir)*

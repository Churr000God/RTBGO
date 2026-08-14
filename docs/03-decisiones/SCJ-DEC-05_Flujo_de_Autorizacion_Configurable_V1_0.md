# SCJ-DEC-05 · ¿Cómo se modela un flujo de autorización de pasos variables sin cablear ninguno?

**Estado:** Propuesta
**Fecha de la decisión:** —
**Última revisión:** —

---

## Contexto

`SCJ-ESP-01 §III.8` exige que una ausencia soporte un **flujo de autorización de varios pasos,
configurable**. No dos pasos, no tres: un número variable, distinto según el tipo de ausencia y
posiblemente según quién la solicita.

**Lo que no se puede hacer:** una columna `autorizado_por_jefe` y otra `autorizado_por_direccion`.
Eso cablea el flujo en el esquema, y el día que se agregue un paso hay que migrar la tabla.

> Es el problema de diseño con más soluciones válidas del proyecto, y por eso está aquí como
> decisión y no como detalle de implementación.

---

## Opciones consideradas

### Opción A — Definición de flujo + instancias de paso

Dos niveles: una **definición** —qué pasos existen para este tipo de ausencia, en qué orden, quién
aprueba cada uno— y una **instancia** por solicitud, con una fila por paso y su estado.

**A favor:** agregar un paso es insertar una fila en la definición, sin tocar el esquema. La
instancia es una bitácora completa de quién aprobó qué y cuándo. Consultar "qué falta" es un filtro.
**En contra:** dos tablas más y la pregunta de qué pasa con las solicitudes en curso cuando la
definición cambia a la mitad — que hay que responder, no ignorar.

### Opción B — Máquina de estados con tabla de transiciones

El flujo es un grafo: estados y transiciones permitidas, cada una con su rol autorizado.

**A favor:** admite bifurcaciones, rechazos, devoluciones y saltos, no sólo una secuencia lineal.
Muy general.
**En contra:** más general de lo que el caso necesita. Con ocho personas y un flujo de dos o tres
pasos, la generalidad se paga sin usarse. Y una máquina de estados mal configurada puede dejar una
solicitud atrapada sin salida.

### Opción C — Cadena de aprobaciones sin definición previa

Sólo la tabla de aprobaciones. Quién debe aprobar se resuelve fuera de la base, en la aplicación,
consultando el organigrama.

**A favor:** el esquema queda mínimo. El flujo puede ser tan complejo como se quiera sin tocar la
base.
**En contra:** **contradice `SCJ-ESP-01 §III.9`** — ninguna regla de negocio codificada. Saca el
flujo del alcance del modelo de datos, que es justamente el objeto de este proyecto. Y el
organigrama vive del otro lado de la frontera.

---

## La pregunta que hay que responder de todos modos

Con cualquiera de las tres:

> **¿Qué pasa con una solicitud en curso cuando cambia la definición del flujo?**

Tres respuestas posibles: la solicitud sigue con la definición vigente al crearse *(vigencias otra
vez → `SCJ-DEC-04`)*, se recalcula con la nueva, o se rechaza el cambio mientras haya solicitudes
abiertas.

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

Configurar un flujo de dos pasos, crear una solicitud, agregar un tercer paso a la definición, y
verificar que la solicitud en curso se comporta como se decidió — sin migración de esquema.

---

## Revisión posterior a la implementación

*(se llena al construir)*

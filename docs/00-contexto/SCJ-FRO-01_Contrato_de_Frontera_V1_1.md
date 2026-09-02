# Contrato de frontera entre subsistemas

**Sistema de Control de Jornada**
Folio SCJ-FRO-01 · Versión 1.1 · 29 de agosto de 2026

> **Cambio de la V1.1.** Se resuelve §V: `fecha_ingreso` se replica en el subsistema de Tiempo,
> de sólo lectura, como única excepción a la regla del §I. Motivo y alcance de la excepción en
> §V. Precisa la regla de §I sin contradecirla en espíritu: sigue siendo cierto que ningún
> atributo de identidad **operativo** cruza; la excepción es un solo campo, documentado, acordado
> como pendiente desde la V1.0.

Qué cruza entre el subsistema de Personas y el de Tiempo. **Una cuartilla, aceptada por ambos
integrantes.** Ninguno la rompe después sin avisar al otro.

---

## I. La regla

> **`persona_id` es lo único que cruza, salvo la excepción documentada en §V.**

Ninguna tabla del subsistema de Tiempo contiene nombre, apellido, CURP, RFC, NSS, domicilio,
correo, teléfono, salario, puesto ni ningún otro atributo de identidad o de compensación. La
única excepción es `fecha_ingreso`, resuelta en §V, y ninguna otra se añade sin pasar por el
procedimiento del §IV.

Si un requisito parece necesitar uno de esos datos dentro del subsistema de Tiempo, **el requisito
está mal planteado** y se replantea.

---

## II. Cómo se implementa

Dos esquemas separados en PostgreSQL:

```
esquema personas          esquema tiempo
├── persona               ├── persona          ← stub: sólo (id)
├── expediente            ├── marca
├── puesto                ├── tramo
├── usuario               ├── jornada_asignada
├── permiso               ├── banco_de_horas
└── asignacion            ├── ausencia
                          └── parametro
```

El esquema `tiempo` recibe un **stub**: una tabla `persona` con una sola columna, `id`. Es el ancla
de las claves foráneas y no contiene nada más.

```sql
CREATE SCHEMA tiempo;
CREATE TABLE tiempo.persona (
  id uuid PRIMARY KEY
);
COMMENT ON TABLE tiempo.persona IS
  'Stub. Identificador opaco. Ningún atributo de identidad vive aquí. Ver SCJ-FRO-01.';
```

`id` es `uuid`, no `bigint`: mismo tipo que `personas.persona.id` en `db/ddl/04_personas.sql`,
porque ambos deben cargar el mismo valor al sincronizar.

**En operación** el stub se sincroniza desde el subsistema de Personas. **En este proyecto** lo
puebla el generador de datos sintéticos.

---

## III. Por qué existe la frontera

Tres razones, en orden de peso:

**1. Protección de datos.** El subsistema de Tiempo es el que más se consulta, el que alimenta
reportes y el que más manos tocan. Cuanto menos dato personal contenga, menor es la superficie
expuesta.

**2. Claridad del diseño.** Un modelo de jornada que no puede mirar el salario no puede caer en la
tentación de calcular nómina. La frontera mantiene el alcance donde debe estar.

**3. División del trabajo.** Los dos subsistemas se diseñan en paralelo, por personas distintas, sin
bloquearse. `persona_id` es el único punto de acuerdo que hace falta.

---

## IV. Qué hacer si aparece un caso que parece necesitar cruzar

**Se discute entre ambos. No se resuelve de forma unilateral.**

El procedimiento:

1. Se escribe el requisito en `SCJ-PRA-01` como pregunta abierta
2. Se busca la reformulación que no cruce la frontera
3. Si no la hay, se decide en sesión conjunta y **se levanta una versión nueva de este documento**

### Los casos que ya se anticiparon, y su respuesta

| Parece necesitar | Se resuelve así |
|---|---|
| Mostrar el nombre en un reporte de asistencia | El reporte se arma **fuera** del subsistema, cruzando `persona_id` en la capa de consulta |
| Calcular el descuento por horas no repuestas | El subsistema de Tiempo entrega **horas**. El monto lo calcula quien tiene el salario |
| Agrupar por área para detectar traslapes de vacaciones | El subsistema de Tiempo tiene un **grupo** propio, sin relación con el organigrama |
| Saber la antigüedad para calcular días de vacaciones | La **fecha de ingreso** es el único candidato a excepción → ver §V |

---

## V. La excepción resuelta — `fecha_ingreso`

El saldo de vacaciones depende de la antigüedad, y la antigüedad depende de la fecha de ingreso, que
vive en el subsistema de Personas.

**Dos salidas evaluadas:**

| Salida | A favor | En contra |
|---|---|---|
| La fecha de ingreso se replica en `tiempo` | El cálculo es autónomo | Es un atributo de identidad. Abre la puerta |
| El subsistema de Personas entrega los **días devengados** ya calculados | La frontera queda intacta | Mueve una regla de tiempo fuera del subsistema de tiempo |

**Decisión: se replica `fecha_ingreso` en `tiempo.persona`.** Razón: toda la lógica de vigencias,
cálculo de saldo y bancos de horas ya vive en Tiempo — repartir el cálculo de antigüedad hacia
Personas rompería esa cohesión sin ganar nada a cambio, porque `fecha_ingreso` no es un dato
sensible por sí solo (a diferencia de salario, CURP o RFC) y no cambia nunca una vez fijado.

**Condiciones de la excepción, para que no se convierta en una puerta abierta:**

1. Es **de sólo lectura** en Tiempo. Se sincroniza desde Personas; Tiempo nunca la escribe ni la
   corrige — una corrección de `fecha_ingreso` se resuelve en Personas y se resincroniza
2. Es el **único** campo de identidad que cruza. Ningún otro requisito futuro se resuelve por
   analogía con éste sin pasar de nuevo por el procedimiento del §IV
3. Se declara explícitamente en el esquema (`COMMENT ON COLUMN`) como excepción documentada,
   apuntando a este folio

```sql
ALTER TABLE tiempo.persona ADD COLUMN fecha_ingreso date NOT NULL;
COMMENT ON COLUMN tiempo.persona.fecha_ingreso IS
  'Excepción documentada a la regla de frontera. Sólo lectura, sincronizada desde Personas.
   Único atributo de identidad que cruza. Ver SCJ-FRO-01 §V.';
```

**Estado:** decidido en preparación de la sesión `J1.2`. Pendiente de validación conjunta con el
compañero del subsistema de Personas antes de darse por aceptado — ver §VI.

---

## VI. Aceptación

| | Nombre | Fecha |
|---|---|---|
| Subsistema de Personas | | |
| Subsistema de Tiempo | | |

Ambos aceptan la regla del §I y el procedimiento del §IV.

---

*Contrato de frontera · Folio SCJ-FRO-01 · V1.1*

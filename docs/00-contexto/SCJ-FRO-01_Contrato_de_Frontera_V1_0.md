# Contrato de frontera entre subsistemas

**Sistema de Control de Jornada**
Folio SCJ-FRO-01 · Versión 1.0 · 22 de agosto de 2026

Qué cruza entre el subsistema de Personas y el de Tiempo. **Una cuartilla, aceptada por ambos
integrantes.** Ninguno la rompe después sin avisar al otro.

---

## I. La regla

> **`persona_id` es lo único que cruza. Nada más.**

Ninguna tabla del subsistema de Tiempo contiene nombre, apellido, CURP, RFC, NSS, fecha de
nacimiento, domicilio, correo, teléfono, salario, puesto ni ningún otro atributo de identidad o de
compensación.

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
  id bigint PRIMARY KEY
);
COMMENT ON TABLE tiempo.persona IS
  'Stub. Identificador opaco. Ningún atributo de identidad vive aquí. Ver SCJ-FRO-01.';
```

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

## V. La excepción en discusión

El saldo de vacaciones depende de la antigüedad, y la antigüedad depende de la fecha de ingreso, que
vive en el subsistema de Personas.

**Dos salidas, ninguna elegida todavía:**

| Salida | A favor | En contra |
|---|---|---|
| La fecha de ingreso se replica en `tiempo` | El cálculo es autónomo | Es un atributo de identidad. Abre la puerta |
| El subsistema de Personas entrega los **días devengados** ya calculados | La frontera queda intacta | Mueve una regla de tiempo fuera del subsistema de tiempo |

**Queda registrada como pregunta abierta en `SCJ-PRA-01` y se resuelve antes del modelo de
ausencias.** Es el punto más frágil del contrato y conviene que esté decidido por escrito.

---

## VI. Aceptación

| | Nombre | Fecha |
|---|---|---|
| Subsistema de Personas | | |
| Subsistema de Tiempo | | |

Ambos aceptan la regla del §I y el procedimiento del §IV.

---

*Contrato de frontera · Folio SCJ-FRO-01 · V1.0*

# Campos de más en los mockups — revisar en la versión final para la empresa

Los mockups del módulo Personas se generaron con IA de diseño y se embellecieron con campos
plausibles de RH que **no existen todavía en el modelo de datos real** (`RTB-APP_DIAGRAMA_V2`,
`personas.persona` y `personas.expediente`). Se recortaron del mockup para que solo muestre lo que
ya hay en base de datos, pero quedan aquí anotados por si conviene agregarlos de verdad cuando se
mire el sistema real de la empresa.

## `11-alta-persona` (formulario de alta)

**Datos personales** — de más: `sexo`, `estado civil`. `persona` real solo tiene:
`primer_nombre`, `segundo_nombre`, `apellido_paterno`, `apellido_materno`, `curp`, `rfc`, `nss`,
`fecha_nacimiento`.

**Alta laboral** — de más, no existen en `persona` ni `expediente`: `número de empleado`,
`tipo de movimiento` (ese concepto es de `bitacora_movimiento_persona`, no de esta pantalla),
`centro de trabajo`, `correo institucional` (el correo se maneja en Auth al dar de alta el
*usuario*, `SCJ-PRO-01` paso A2 — no es campo de la persona/expediente). `tipo_contrato` sí existe
en `expediente` (enum real: `indefinido` / `prestacion_servicios` / `por_proyecto` — no
"Indeterminado").

**Puesto/área en esta misma pantalla** — de más: asignar puesto en el alta de persona no está
diseñado todavía, es el proceso aparte de "asignaciones, puestos, áreas y permisos" que el usuario
dejó pendiente (candidato a `SCJ-PRO-03`).

**Referencia de expediente** — de más: `tipo de resguardo`, `ubicación física`, y el checklist de
documentos individuales (acta de nacimiento, CURP, comprobante de domicilio, constancia de
situación fiscal, contrato individual) cada uno con estatus propio cargado/pendiente.
`expediente` real solo tiene **una** columna `documento_ref` (`varchar(50)`, formato
`RTB-__-__`) — una sola referencia, no una tabla de documentos. El archivo en sí se resuelve con
un bucket de Supabase Storage (confirmado con el usuario), pero eso es implementación detrás de
ese único campo, no una tabla nueva.

## `10-ficha-persona` (ficha de detalle)

**Contacto de emergencia** — de más por completo. No existe ninguna tabla ni campo para esto en el
modelo. Si se quiere en la versión real, es una tabla nueva a diseñar (contacto, teléfono, tipo de
sangre, domicilio, parentesco).

**Expediente** — mismo caso que en `11`: el checklist de documentos con fechas y estatus
individuales no tiene respaldo real, solo existe `documento_ref`.

**Puesto y área actuales** — de más: `jefe inmediato`. El resto (puesto, área, vigente desde) sí
tiene respaldo real en `asignacion`/`puesto`/`departamento`.

**Histórico de movimientos** — corregido para respetar `SCJ-PRO-02` ya cerrado: mezclaba cambios de
puesto/área con cambios de `estado` en una sola tabla. `bitacora_movimiento_persona` **solo**
registra los 3 valores de `estado` (alta/suspensión/reactivación/baja) — los cambios de puesto/área
viven en `asignacion`, tabla y concepto distintos. El mockup se separó en dos bloques para no
implicar que es un solo historial.

**Estado actual / Asistencia** (banco de horas, puntualidad, incidencias) — estos SÍ tienen
respaldo real en el subsistema Tiempo ya cerrado (`saldo`, `ausencia`, `excepcion`, `marca`), no son
extras.

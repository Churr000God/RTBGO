# Reporte QA — Fidelidad visual del módulo Personas y Usuarios (11-13)

Fecha: 2026-09-03 (continuación de la sesión de `bitacora/2026-09-03_qa_auth_backend.md` y del plan
de QA de mockups de Personas/Usuarios)
Rol: `frontend` — Tarea F del plan (fidelidad visual de `AltaPersonaPage`, `AltaUsuarioPage`,
`CambiarEstadoPage` contra `diseno_paginas/personas/11-13`)

Este documento cubre sólo la Tarea F (fidelidad visual de 11/12/13). Las pantallas 07-10 y 14
(brecha funcional real) se documentan aparte cuando cierre esa ola.

## Nota sobre la skill `/design`

El plan pedía invocar `Skill({ skill: "design", ... })` para esta revisión. Al invocarla se
confirmó que esa skill es para **crear/publicar un canvas nuevo de diseño** (artboards `.dc.html`
sobre un Artifact de Claude Design), no para comparar código React ya existente contra un mockup
y aplicar cambios directo al `.tsx`/`tokens.css` — no genera ese tipo de salida. En vez de forzar
la skill a un uso que no es el suyo (publicar tres canvases nuevos sin que nadie los edite ni
alimenten el código real), se hizo la comparación de fidelidad manualmente: lectura directa de
los 3 PNG + los `.tsx` actuales + `tokens.css`, aplicando el mismo criterio cosmético/estructural
que pedía el plan. Avisado a `orchestrator` en el reporte de esta tarea.

## `11-alta-persona` — `AltaPersonaPage.tsx`

**Hallazgo:** el formulario era una lista plana de `label`+`input` sin agrupación, sin migas, sin
iconografía — el mockup agrupa en 3 tarjetas (Datos personales / Alta laboral / Referencia de
expediente), cada una con ícono, y usa un control segmentado para "Tipo de contrato" en vez de
radios sueltos.

**Decisión:** aplicar directo lo cosmético/local — agrupación en `<fieldset>` con ícono
(`.icono-seccion`/`.encabezado-fieldset`), rejilla responsiva de campos (`.rejilla-campos`),
captions de ayuda bajo CURP/RFC/NSS/`documento_ref` (`.ayuda-campo`), migas (`.migas`), y "Tipo de
contrato" convertido a control segmentado con `:has(input:checked)` (`.opciones-seleccionables`),
sin tocar la semántica de radios nativos. Se agregó un link "Cancelar" junto al botón de envío.

**Acción:** implementado en el mismo commit de esta tarea. `npm test` verde,
comparación visual confirmada con `mcp__claude-in-chrome__*`.

**No implementado (estructural o sin respaldo real — ver `NOTAS_campos_extra_mockups.md`):**
- Panel lateral "Vista previa" (avatar/CURP/NSS/ingreso en vivo) — panel lateral nuevo.
- Panel "Validaciones" (dígito verificador de CURP, cruce NSS contra el padrón) — necesita lógica
  de validación real que no existe hoy ni en frontend ni backend.
- Checklist "Al registrar el alta" — copy informativo nuevo, no es fidelidad de layout.
- "Guardar borrador" — sin endpoint, sin modelo de borradores.
- Subida de archivo del expediente al bucket — sin endpoint de Storage (ya en `NOTAS`).
- Callout "Vigencia inicial" — copy de negocio nuevo, no aplicado; se puede agregar sin
  dependencias si el usuario lo pide explícitamente.

## `12-alta-usuario` — `AltaUsuarioPage.tsx`

**Hallazgo:** mismo patrón — sin agrupación ni migas; el `<select>` de persona no tenía ícono; el
botón de envío no tenía ícono ni había link de cancelar.

**Decisión:** aplicar directo — migas, `<fieldset>` "Datos de acceso" con ícono, extendida
`.campo-con-icono` para soportar también `<select>` (antes sólo `<input>`), ícono de sobre en
correo, caption de vigencia del enlace (72 horas, copy del mockup), ícono en el botón de envío,
link "Cancelar".

**Acción:** implementado. Sin test previo para esta página (no existía
`AltaUsuarioPage.test.tsx`); no se rompió nada del resto de la suite.

**No implementado:**
- Layout de navegación superior del mockup (barra horizontal) en vez del sidebar del `AppShell`
  real — cambio de layout global, fuera de esta pantalla.
- Combobox de búsqueda con card de preview (número de empleado/puesto/área) — campos sin
  respaldo real (`NOTAS`). El `<select>` simple se mantiene; si se quiere combobox real sin esos
  campos inexistentes, dos opciones para decidir: (A) construir búsqueda client-side sobre la
  lista de personas ya cargada, sin backend nuevo; (B) dejarlo como está.
- Panel "Qué ocurre al enviar" (3 pasos) y panel "Permisos" — paneles laterales nuevos.
- Tabla "Invitaciones pendientes" con reenviar — no hay endpoint que liste invitaciones.

## `13-cambio-estado` — `CambiarEstadoPage.tsx`

**Hallazgo funcional (no sólo cosmético):** confirmado el mismo bug que `FichaPersonaPage` — la
página **no estaba envuelta en `AppShell`**, así que al entrar acá desaparecía el sidebar
completo. Además los 3 radios de "Tipo de cambio" eran texto plano sin ícono ni descripción, y no
se mostraba a quién se le estaba cambiando el estado ni su estado actual.

**Decisión:**
1. Envolver en `<AppShell>` (fix del bug de sidebar).
2. Convertir los 3 radios en tarjetas seleccionables (`.opciones-seleccionables` +
   `.opcion-seleccionable`, ícono + título + descripción, estado seleccionado vía
   `:has(input:checked)`) — **cuidado explícito del plan respetado**: cada opción sigue siendo un
   `<label>` que envuelve su `<input type="radio">`, así que
   `getByLabelText(/suspensión/i)` en el test sigue resolviendo el mismo control (el nombre
   accesible del label ahora incluye también la descripción, pero el matcher es una regex parcial
   — sigue encontrando el input).
3. Agregar una cabecera compacta (`.cabecera-persona`) con avatar de iniciales, nombre y badge de
   estado actual (`.insignia-estado`), consultando `GET /api/personas/{id}` (endpoint que ya
   existe, sin backend nuevo) — versión simplificada del header del mockup, sin panel lateral.

**Acción:** implementado. `CambiarEstadoPage.test.tsx` se amplió con un mock de
`../lib/supabaseClient` (el `AppShell` nuevo llama `getUser()`); el test existente
(`exige motivo y envía el movimiento elegido`) sigue verde sin cambios en sus aserciones.

**No implementado (estructural o sin respaldo real — ver `NOTAS_campos_extra_mockups.md`):**
- Panel lateral derecho completo del mockup ("Resumen del cambio" con pill antes→después, "Al
  confirmar" con bullets, "Historial de estados") — panel lateral nuevo. La cabecera compacta
  agregada cubre parte de esa necesidad (saber a quién y su estado actual) sin el panel.
- Campos "Fecha de efecto" / "Reincorporación estimada" — no existen en
  `bitacora_movimiento_persona` (sólo `fecha_efectiva`, fijada por el servidor).
- "Historial de estados" en el panel lateral — depende de la pantalla de bitácora (`14`, Ola 2 del
  plan, todavía no implementada).
- Layout de navegación superior del mockup — mismo caso que `12`.

## Resumen

| Pantalla | Bug funcional | Fidelidad cosmética aplicada | Estructural pendiente (opciones para el usuario) |
|---|---|---|---|
| 11-alta-persona | — | Sí (fieldsets+iconos, rejilla, captions, migas, control segmentado) | Panel de vista previa, validaciones reales, borrador, subida de archivo |
| 12-alta-usuario | — | Sí (fieldset+icono, campo-con-icono en select, botón con icono) | Combobox real, paneles "Qué ocurre"/"Permisos", tabla de invitaciones |
| 13-cambio-estado | **Sí — sidebar desaparecía** (arreglado) | Sí (tarjetas seleccionables, cabecera de persona) | Panel lateral completo, fecha de efecto/reincorporación (requiere columnas nuevas) |

`npm test`: verde en las 3 páginas tocadas (suite completa, sin regresiones). `npx tsc -b`: sin
errores. Comparación visual con `mcp__claude-in-chrome__*` contra los 3 PNG originales.

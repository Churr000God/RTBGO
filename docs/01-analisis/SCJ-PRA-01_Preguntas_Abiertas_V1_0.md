# Preguntas abiertas

**Sistema de Control de Jornada**
Folio SCJ-PRA-01 · Versión 1.0 · Agosto de 2026

Lista viva. Toda duda que aparece se anota aquí antes de resolverse. **Una pregunta que se resuelve
sin pasar por esta lista es una pregunta que nadie va a recordar en octubre.**

---

## I. Abiertas

| # | Pregunta | Levantada en | Fecha | Bloquea a |
|---|---|---|---|---|
| 01 | `ausencia.estado_autorizacion` se implementó como un solo campo (`pendiente`/`autorizada`/`rechazada`) para poder programar algo — pero `SCJ-DEC-05` exige un flujo de pasos variables configurable. ¿Se sustituye esa columna cuando DEC-05 se resuelva, y qué pasa con las filas ya cargadas? | Sesión 2026-09-02, al implementar `db/ddl/02_tiempo.sql` | 2 sep | `SCJ-DEC-05` |
| 02 | `POST /api/usuarios` (`backend/app/routers/usuarios.py:11`) usaba `get_service_client` (service_role) sin ningún chequeo de autenticación — cualquiera que alcanzara el endpoint podía invitar un usuario y atarlo al `persona_id` que quisiera. **Parcialmente resuelto 3 sep**: se agregó `Depends(get_caller_client)` — ahora exige Bearer token, igual que `personas.py`/`movimientos.py`. Sigue abierto: `personas.fn_caller_activo()` (la única RLS de `personas`) sólo valida "el caller tiene una persona activa detrás", sin distinción de rol — cualquier empleado activo con token válido puede invitar usuarios y atarlos a cualquier `persona_id`. No existe en el proyecto ningún concepto de permiso/rol todavía (`puesto`/`área`/`permiso` quedaron fuera de alcance de `SCJ-PRO-01`, decisión explícita). ¿Se gatea `alta_usuario` con una RLS/chequeo de rol admin explícito, o se introduce un modelo de permisos antes? Decisión de Diego (3 sep, vía orchestrator): aplicar sólo el gate de token ahora, el de rol queda para otra sesión. | Auditoría de seguridad, sesión `security` (rol) | 3 sep | modelo de permisos/rol (sin decisión aún) |
| 03 | `react-router-dom` en frontend (6.30.6) tiene 2 avisos moderados (open redirect y constructor injection en hidratación SSR — este último no aplica, la SPA no hace SSR). El único fix es bump mayor 6→7 (`npm audit fix --force`, breaking). Decisión de Diego (3 sep): no hacer el bump ahora, se hace después del QA de auth en sesión aparte. | Auditoría de seguridad, sesión `security` (rol) | 3 sep | ninguno todavía |

---

## II. Resueltas

| # | Pregunta | Respuesta | Dónde quedó | Fecha |
|---|---|---|---|---|
| 01 | ¿La fecha de ingreso cruza la frontera, o el subsistema de Personas entrega los días devengados? | Se replica en `tiempo.persona`, de sólo lectura, como única excepción documentada | `SCJ-FRO-01 §V` | 29 ago |
| 02 | ¿El saldo se calcula al vuelo o se materializa? | Libro de movimientos (`movimiento_de_saldo`) como fuente de verdad, más un total materializado sólo de lectura, escrito únicamente por disparador | `SCJ-DEC-02` | 2 sep |
| 03 | ¿`requiere_revision`/`motivo_revision` en la marca, o entidad de excepción aparte? | Entidad `excepcion` con ciclo de vida propio; `marca.requiere_revision` queda como bandera rápida | `SCJ-DEC-07` | 2 sep |
| 04 | ¿El día es entidad materializada o estado derivado? | Materializada, con un cuarto estado (`revisado`) que las opciones originales no contemplaban | `SCJ-DEC-06` | 2 sep |
| 05 | ¿Versionado, auditoría o eventos para las correcciones? | Registro de eventos: `correccion` apunta a la `marca` original, que nunca se modifica | `SCJ-DEC-03` | 2 sep |
| 06 | ¿Cómo sabe el sistema que un día es festivo, para separar el pago de domingo/festivo trabajado? | Catálogo nuevo `dia_festivo` (no calculable por fórmula, festivos móviles). Domingo se deriva de la fecha, sin catálogo | `SCJ-MOD-02 §II.13` | 2 sep |
| 07 | Si una ausencia se carga tarde (después de que ya se generó una excepción por el día sin checada), ¿se resuelve sola o alguien la cierra a mano? | Se resuelve sola por disparador cuando `estado_autorizacion` pasa a `autorizada` — RH no tiene que cerrarla | `db/ddl/02_tiempo.sql` (`trg_ausencia_resuelve_excepcion`) | 2 sep |

---

## III. Cerradas sin resolver

Preguntas que dejaron de importar, o que se decidió no responder en este proyecto. **Se registran
para que nadie las vuelva a abrir sin saber que ya se descartaron.**

| # | Pregunta | Por qué se cierra | Fecha |
|---|---|---|---|
| | | | |

---

*Preguntas abiertas · Folio SCJ-PRA-01 · V1.0*

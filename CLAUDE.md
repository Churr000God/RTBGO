# CLAUDE.md

Instrucciones que se cargan cada sesión para trabajar en `sistema-control-jornada`.

## Qué es el proyecto

Sistema de Control de Jornada (SCJ) — proyecto académico, caso de estudio *Distribuidora Central,
S.A. de C.V.* (empresa ficticia). Cubre el modelo de datos del subsistema de Tiempo, más un
backend y un frontend que lo exponen. Ver `README.md` y `docs/00-contexto/SCJ-CTX-01_*.md`.

## Stack y cómo correrlo

- **Base de datos:** Supabase (Postgres administrado, extensión `btree_gist`), esquemas
  `personas` y `tiempo`, ambos con DDL real (decisión de sesión 2026-08-31: `personas` ya no es
  sólo stub — ver `bitacora/2026-08-31_campos_persona.md`). El stub original de `tiempo.persona`
  se mantiene como ancla de la frontera (`SCJ-FRO-01`); `personas.persona` es la implementación
  completa. **No hay Postgres local ni contenedor de base de datos** — el DDL de `db/ddl/` corre
  contra el proyecto de Supabase, vía `psql "$DATABASE_URL"` o pegado en su SQL Editor.
  Configuración en `.env` (plantilla en `.env.example`). Pasos completos en `README.md`
  §"Cómo levantar el proyecto".
- **Generador de datos sintéticos:** Python, en `tools/generador/` — carpeta vacía por ahora
  (`SCJ-GEN-01`, entregable `E5`). Se invoca con `uv run python generar.py ...`, no `python3`
  directo: `python3` está bloqueado por un hook de este entorno.
- **Backend:** FastAPI + `supabase-py` v2, en `backend/app/` (routers/schemas/deps/config).
  Manual: `cd backend && uv run uvicorn app.main:app --reload --port 8000`. Tests:
  `uv run pytest`. Lee `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `FRONTEND_URL` del `.env` de la raíz (no lee `DATABASE_URL`, eso es sólo para `psql`/DDL manual).
- **Frontend:** Vite + React + TypeScript, en `frontend/src/` (pages/layouts/router). Manual:
  `cd frontend && npm run dev` (puerto 5173). Tests: `npm test`. `diseno_paginas/` guarda el
  diseño de pantallas (mockups "Kairos") previo a implementarlas — sigue siendo la referencia
  visual mientras dure el QA módulo por módulo. `lucide-react` es la única librería de iconos del
  proyecto (sumada en el QA de auth de 2026-09-03 para replicar la capa decorativa de los
  mockups de login/2FA/recuperación de contraseña). Los correos de contacto que la app muestra
  (Recursos Humanos, Sistemas, Administración, Dirección) son configurables por variable de
  entorno — `VITE_CONTACTO_RH_CORREO`, `VITE_CONTACTO_SISTEMAS_CORREO`,
  `VITE_CONTACTO_ADMINISTRACION_CORREO`, `VITE_CONTACTO_DIRECCION_CORREO` en `frontend/.env.example`
  — nunca hardcodeados en el código de las páginas. Sólo frontend las usa (el backend no envía
  correos, delega 100% en Supabase Auth). Mismo gotcha que las demás `VITE_*`: en prod son de
  build, cambiar el valor exige `--build`, no basta reiniciar el contenedor.
- **Docker:** `./scripts/desplegar.sh [dev|prod] <levantar|bajar|reconstruir|registros|pruebas|estado>`
  levanta backend + frontend con `docker compose` (dev con hot reload, prod con nginx sirviendo el
  build). No hay contenedor de base de datos — sigue siendo Supabase remoto. Las `VITE_*` del
  frontend son variables de **build**, no de runtime: cambiarlas en prod exige `--build`, no basta
  reiniciar el contenedor. `prod pruebas` **no existe** — la imagen prod del backend se instala con
  `--no-dev` (sin pytest) y el frontend prod es nginx sirviendo el bundle (sin npm/node); el script
  corta con un mensaje explícito en vez de fallar con un error de `docker exec`. Las pruebas
  siempre corren con `dev pruebas`.
- **Tests:** backend `uv run pytest` (117 casos), frontend `npm test` (221 casos). Ambos corren
  igual dentro de los contenedores (`./scripts/desplegar.sh <entorno> pruebas`). Cobertura
  instrumentada desde el 4 de septiembre de 2026: `uv run pytest --cov=app --cov-report=term-missing`
  (backend, 97%) y `npm run test:coverage` / `npm test -- --coverage` (frontend, 92.4% líneas / 82.5%
  ramas) — medición habilitada, sin umbral mínimo forzado todavía. `backend/.coverage` y
  `frontend/coverage/` son artefactos generados, no se versionan.
- **CI:** `.github/workflows/ci.yml` (agregado 4 de septiembre de 2026) corre backend (`uv run
  pytest`) y frontend (`vitest run`) en cada push/PR — sin secrets de Supabase (todos los tests
  mockean el cliente de Supabase, ninguno pega contra el proyecto real). No hace deploy, sólo
  valida.
- **Módulo Personas y Usuarios (`SCJ-PRO-01`/`SCJ-PRO-02`):** entregado el 3 de septiembre de 2026,
  de punta a punta (backend + frontend + DDL de `personas`). Puesto/área/departamento/permiso/
  asignación quedaron **fuera de alcance a propósito** — no asumir tablas ni endpoints de eso.
  **QA manual completado el 4 de septiembre de 2026** contra las 14 pantallas de
  `diseno_paginas/personas/` (incluida la bitácora de movimientos, pantalla nueva); sumó el
  endpoint `GET /api/sesion` para el enforcement real de cuenta suspendida (antes sólo existía
  el bloqueo de RLS, sin feedback en la UI). Ver `bitacora/2026-09-04_qa_personas_mockups.md`.
  **Segundo bloque de fixes, mismo día**: login centrado en pantallas grandes, CURP/RFC
  normalizados a mayúsculas (frontend y backend), fix de usuario huérfano en Supabase Auth si
  fallaba el insert tras la invitación, auditoría de inyección SQL sin hallazgos (el diseño ya la
  cubre por construcción: `supabase-py` parametrizado + Pydantic), pasada de calidad visual en
  09-14 y fix del bug real de "Alta de usuario" inalcanzable (ahora hay botón "Crear acceso a
  Kairos" en la ficha, condicionado al campo `tiene_usuario` de `GET /api/personas/{id}`). Ver
  `bitacora/2026-09-04_qa_personas_fixes.md`.
- **Módulo Estructura Organizacional (`SCJ-PRO-03/04/05`):** entregado el 4 de septiembre de 2026,
  de punta a punta, en 5 cortes delegados al equipo (`area` → `departamento` → `puesto` →
  `asignacion` → `puesto_permiso`, commits `847fa96`/`628587f`/`2e14b46`/`3de346f`/`d3997cb`).
  Catálogo de 16 permisos (`personas.permiso`, única tabla del proyecto con `codigo varchar` como
  `PRIMARY KEY`), otorgar/revocar con validación real de auto-otorgamiento y herencia jerárquica,
  y un mecanismo de "usuario base de bootstrap" en `./scripts/desplegar.sh` (crea un usuario con
  todos los permisos al desplegar desde cero, credenciales por prompt interactivo, nunca en
  `.env` — ver memoria de proyecto `usuario-base-bootstrap`). **El gate de permisos real YA ESTÁ
  conectado** (commit `a52b534`, mismo día): `backend/app/permisos.py` resuelve los puestos
  vigentes del caller y la herencia jerárquica (el jefe hereda lo del subordinado), y
  `requiere_permiso(...)` (primer `403` del proyecto) gatea los 7 routers relevantes —
  `areas`/`departamentos`/`puestos`/`asignaciones`/`permisos` (lectura exige lectura-o-edición,
  escritura exige edición) y `personas`/`usuarios`/`movimientos` (sólo sus `POST`, con
  `alta_personas_usuarios`/`cambio_estado_persona` — sus `GET` siguen con el gate débil a
  propósito, el catálogo de 16 permisos no tiene código de lectura para ese módulo).
  `GET /api/sesion` expone `puede_ver_modulo_1`/`puede_ver_modulo_2` para que el sidebar oculte
  grupos completos sin permiso (fail-open si la sesión no carga). Primer `CREATE OR REPLACE
  FUNCTION` y primer RPC del proyecto (`fn_asignacion_cambiar_puesto`) aparecieron en el corte de
  `asignacion`. La base se **wipeó y reconstruyó por completo** el mismo día (`DROP SCHEMA
  personas/tiempo CASCADE` + reaplicación de todo el DDL versionado, `auth.users` vaciado vía
  Admin API) para eliminar 4 cuentas de desarrollo que la inmutabilidad de la bitácora hacía
  imposible borrar quirúrgicamente — el único usuario que queda es el usuario base de bootstrap,
  con los 16 permisos y 2FA configurado. Ver
  `bitacora/2026-09-04_modulo_{area,departamento,puesto,asignacion,puesto_permiso}.md` para el
  detalle de cada corte.
- **Pase de mejora cross-stack con equipo de 6 especialistas (4 de septiembre de 2026):** con el
  gate de permisos ya conectado, el usuario pidió una pasada de optimización orquestada —
  `orchestrator` coordinó por `SendMessage` a 6 sesiones persistentes (`frontend`/`backend`/`db`/
  `testing`/`security`/`devops`, roster fijo de `team-orchestrator`) para que cada una explorara y
  mejorara su dominio con sus propias skills, sin commitear nada individualmente (commits
  batcheados al final por dominio, revisados por `orchestrator`). Resultado: capa de componentes
  UI reutilizables en frontend (`Button`/`Card`/`Badge`/`Input`, `frontend/src/components/`,
  primera vez que el proyecto tiene componentes compartidos más allá de `CasilleroCodigo`/
  `TemporizadorTotp`) usada para migrar las 17 páginas de Estructura Organizacional (construidas
  sin mockup) más el rediseño de `Configurar2FAPage` (era la única pantalla de auth sin nivelar al
  resto); helper `backend/app/errores.py` deduplicando el patrón `APIError` 23505 → `409` de 4
  routers; 21 índices FK nuevos (`db/ddl/30_indices_fk.sql`); cobertura instrumentada (ver más
  arriba); CI agregado (ver más arriba). Ver `bitacora/2026-09-04_pase_mejora_cross_stack_equipo.md`
  para el detalle completo, incluido el hallazgo de seguridad crítico documentado abajo.

## Arquitectura y módulos

- Dos esquemas separados por una frontera explícita (`docs/00-contexto/SCJ-FRO-01_*.md`):
  `persona_id` es el único dato que cruza de `personas` a `tiempo`. Ningún atributo de identidad
  vive en `tiempo`.
- El DDL se diseña y prueba aquí, sobre datos sintéticos, y se copia a RTB-App como migración.
  **Nunca en sentido inverso** — ningún dato real regresa a este repositorio.
- Mapa de carpetas completo en `README.md` §"Estructura del repositorio".

## Reglas de negocio críticas

Cada una vive en su propio documento de decisión — no se duplican aquí, sólo se referencian:

- Validación de paridad de marcas → `docs/03-decisiones/SCJ-DEC-01_*.md`
- Saldo del banco de horas → `docs/03-decisiones/SCJ-DEC-02_*.md`
- Modelo de correcciones (inmutabilidad de la marca) → `docs/03-decisiones/SCJ-DEC-03_*.md`
- Vigencias temporales sin traslape → `docs/03-decisiones/SCJ-DEC-04_*.md`
- Flujo de autorización configurable → `docs/03-decisiones/SCJ-DEC-05_*.md`
- Entidad día o estado derivado (día bloqueado) → `docs/03-decisiones/SCJ-DEC-06_*.md`
- Modelo de excepciones (`requiere_revision`/`motivo_revision`) → `docs/03-decisiones/SCJ-DEC-07_*.md`
- Clave de la marca (`evento_id`) → `docs/03-decisiones/SCJ-DEC-08_*.md`
- Unicidad parcial de secuencia (`terminal_id` + `secuencia_local`) → `docs/03-decisiones/SCJ-DEC-09_*.md`

## Gotchas conocidos

- **Ningún documento con folio `RTB-` entra al repositorio** (`.gitignore` los excluye por
  patrón). Identifican a la empresa real. Ver `docs/00-contexto/SCJ-ANO-01_*.md`.
- Los valores de política en `db/ddl/03_parametros_ejemplo.sql` son de ejemplo, no reales.
- Los diagramas se versionan como texto (Mermaid/PlantUML) en `diagramas/fuente/`, nunca binarios.
- La versión en el nombre de archivo y la del encabezado del documento siempre coinciden
  (`CONVENCIONES.md`).
- El esquema se congela el 25 de septiembre de 2026 (`docs/06-actas/SCJ-ACT-03_*.md`); después de
  esa fecha ningún cambio sin que RTB-App se entere.
- `SCJ-PRA-01`, `SCJ-TRZ-01`, `SCJ-GLO-01` y `bitacora/` son documentos vivos: se tocan en cada
  sesión de trabajo, no se "empiezan" una vez.
- Exponer un esquema en Data API (Dashboard → Integrations → Data API → Settings → Exposed
  schemas) **no** otorga permisos de Postgres — hace falta además el `GRANT` explícito
  (`db/ddl/08_personas_permisos.sql`). Sin los dos, PostgREST responde "permission denied for
  schema…" aunque el esquema se vea expuesto en el dashboard.
- El dashboard de Supabase (Site URL, Redirect URLs, plantillas de correo) tiene
  `http://localhost:5173` fijo a mano — esa configuración no vive en este repositorio. Al pasar a
  producción (`docker compose … prod`, frontend en `:8080`) hay que actualizarla ahí también, o
  los links de invitación/recuperación de contraseña no aterrizan en la app.
- El DDL corre hasta `db/ddl/31_*.sql`. `personas.permiso`
  es la única tabla del proyecto con clave natural (`codigo varchar PRIMARY KEY`) en vez de `uuid`
  — decisión deliberada, fiel a la redacción literal de `SCJ-PRO-05`, no un descuido a corregir.
- Las tablas de bitácora inmutables (`bitacora_movimiento_persona`,
  `bitacora_movimiento_puesto_permiso`) bloquean `UPDATE`/`DELETE` **incluso para `postgres`** — a
  propósito, es la garantía de auditoría. Consecuencia real: si una cuenta de desarrollo/QA generó
  aunque sea una fila ahí (como autor o como persona afectada), no se puede borrar esa cuenta
  quirúrgicamente ni con acceso de superusuario. La única salida limpia es `DROP SCHEMA ... CASCADE`
  + reaplicar el DDL versionado desde cero (que sí regenera todo el dato real, porque está
  capturado en archivos `.sql`) — no intentar desactivar el trigger ni forzar el `DELETE`.
- `ALTER DEFAULT PRIVILEGES` de `08_personas_permisos.sql` le da `GRANT ALL` a cualquier tabla nueva
  creada por el mismo rol — eso incluye `UPDATE`/`DELETE`, que un `GRANT` explícito más chico
  (`SELECT, INSERT`) **no revoca** (`GRANT` es aditivo). Toda tabla de bitácora nueva que deba ser
  inmutable necesita su propio `REVOKE UPDATE, DELETE` explícito desde el arranque, no asumir que
  "nunca se concedieron" sólo porque el `GRANT` del archivo no los menciona (hallazgo real de
  seguridad en el corte de `puesto_permiso`, corregido en `28_*.sql`).
- **RLS no es automáticamente autorización — puede ser sólo autenticación disfrazada.** Hasta
  `30_*.sql`, las policies de `area`/`departamento`/`puesto`/`asignacion`/`permiso`/
  `puesto_permiso`/`persona`/`usuario` sólo exigían `fn_caller_activo()` (persona activa, no
  suspendida) para INSERT/UPDATE/DELETE — nunca el permiso específico que sí valida
  `backend/app/permisos.py::requiere_permiso(...)`. Como los 7 routers de Estructura
  Organizacional/Personas usan `get_caller_client` (anon key + JWT del usuario, sujeto a RLS) para
  **toda** lectura y escritura — nunca `service_role` — y el esquema está expuesto en Data API con
  `GRANT ALL` a `anon`/`authenticated`, cualquier persona activa podía pegarle directo a PostgREST
  (bypaseando FastAPI por completo) e insertar en `bitacora_movimiento_puesto_permiso`; el trigger
  `fn_puesto_permiso_sincroniza` sincronizaba eso en un otorgamiento real, sin pasar por ninguna de
  las validaciones de auto-otorgamiento de `routers/permisos.py`. Escalaba a admin total del
  módulo de permisos partiendo de cualquier cuenta. Corregido en
  `31_personas_rls_permiso_especifico.sql`: `personas.fn_caller_tiene_permiso(codigo)` replica en
  SQL (con herencia jerárquica) la misma lógica de `tiene_permiso()` de Python, y las policies de
  escritura ahora la exigen además de `fn_caller_activo()`. **Lección para módulos nuevos:** si un
  router usa `get_caller_client` en vez de `service_role`, la policy RLS de esas tablas es la
  autorización real, no un respaldo — hay que validar el permiso específico ahí, no sólo "¿está
  activo?".

## Historial de decisiones

Vacío por ahora. Las decisiones de diseño están en `docs/03-decisiones/`; la retrospectiva final
en `docs/05-entrega/SCJ-ENT-03_*.md`.

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
  visual mientras dure el QA módulo por módulo.
- **Docker:** `./scripts/desplegar.sh [dev|prod] <levantar|bajar|reconstruir|registros|pruebas|estado>`
  levanta backend + frontend con `docker compose` (dev con hot reload, prod con nginx sirviendo el
  build). No hay contenedor de base de datos — sigue siendo Supabase remoto. Las `VITE_*` del
  frontend son variables de **build**, no de runtime: cambiarlas en prod exige `--build`, no basta
  reiniciar el contenedor. `prod pruebas` **no existe** — la imagen prod del backend se instala con
  `--no-dev` (sin pytest) y el frontend prod es nginx sirviendo el bundle (sin npm/node); el script
  corta con un mensaje explícito en vez de fallar con un error de `docker exec`. Las pruebas
  siempre corren con `dev pruebas`.
- **Tests:** backend `uv run pytest` (7 casos), frontend `npm test` (9 casos). Ambos corren igual
  dentro de los contenedores (`./scripts/desplegar.sh <entorno> pruebas`).
- **Módulo Personas y Usuarios (`SCJ-PRO-01`/`SCJ-PRO-02`):** entregado el 3 de septiembre de 2026,
  de punta a punta (backend + frontend + DDL de `personas`). Puesto/área/departamento/permiso/
  asignación quedaron **fuera de alcance a propósito** — no asumir tablas ni endpoints de eso.
  **El QA manual pantalla por pantalla contra los 14 mockups de `diseno_paginas/personas/` sigue
  pendiente** — el módulo se mergeó a `main` antes de correrlo (decisión explícita del usuario);
  ver `bitacora/2026-09-03_dockerizacion.md`.

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

## Historial de decisiones

Vacío por ahora. Las decisiones de diseño están en `docs/03-decisiones/`; la retrospectiva final
en `docs/05-entrega/SCJ-ENT-03_*.md`.

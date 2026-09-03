# Sistema de Control de Jornada — SCJ

**Diseño de base de datos · Subsistema de Tiempo**
Proyecto académico · Caso de estudio: *Distribuidora Central, S.A. de C.V.*

Diseño e implementación del modelo de datos de un sistema de registro y cálculo de jornada
laboral para una empresa distribuidora de ocho empleados en México.

---

## Qué es esto

Una empresa pequeña lleva hoy el control de asistencia de forma verbal, sin registro. A partir del
1 de enero de 2027 la legislación mexicana le exigirá un registro electrónico de jornada. Este
proyecto diseña la base de datos que lo sostiene.

El sistema completo se compone de dos subsistemas separados por una frontera explícita:

| Subsistema | Contenido | En este repositorio |
|---|---|---|
| **Personas** | Identidad, expediente, puestos, usuarios, permisos | Sólo como referencia |
| **Tiempo** | Marcas, jornadas, saldos, ausencias | **Todo el trabajo** |

La frontera está documentada en [`SCJ-FRO-01`](docs/00-contexto/SCJ-FRO-01_Contrato_de_Frontera_V1_0.md):
el subsistema de Tiempo referencia a las personas **exclusivamente por un identificador opaco**.

> **Todos los datos de este repositorio son sintéticos.** Empresa ficticia, personas inventadas,
> identificadores arbitrarios. Ver [`SCJ-ANO-01`](docs/00-contexto/SCJ-ANO-01_Reglas_de_Anonimizacion_V1_0.md).

---

## Por dónde empezar a leer

1. [`SCJ-CTX-01`](docs/00-contexto/SCJ-CTX-01_Contexto_y_Alcance_V1_0.md) — el caso y su alcance
2. [`SCJ-ESP-01`](docs/00-contexto/SCJ-ESP-01_Especificacion_Funcional_V1_0.md) — **qué debe poder representar el modelo**
3. [`SCJ-MOD-01`](docs/01-analisis/SCJ-MOD-01_Modelo_Conceptual_V1_0.md) — modelo conceptual
4. [`SCJ-MOD-02`](docs/02-modelo/SCJ-MOD-02_Modelo_Logico_V1_0.md) — modelo lógico
5. [`docs/03-decisiones/`](docs/03-decisiones/) — **las nueve decisiones de diseño** *(lo más sustancioso del proyecto)*
6. [`SCJ-TRZ-01`](docs/01-analisis/SCJ-TRZ-01_Matriz_de_Trazabilidad_V1_0.md) — requisito → tabla → consulta que lo demuestra

---

## Cómo levantar el proyecto

La base de datos vive en **Supabase** (Postgres administrado). No hay Postgres local ni
contenedor de base de datos: el DDL corre contra el proyecto de Supabase, directo. Backend y
frontend sí se pueden levantar en contenedores.

### Requisitos

- Una cuenta y un proyecto de Supabase (gratis para desarrollo), **propio de este proyecto** — no
  se comparte con ningún entorno operativo
- Python 3.11 o superior, gestionado con `uv` *(sólo para el generador de datos sintéticos y para
  correr el backend manualmente)*
- Docker + Docker Compose *(vía A, recomendada)*, o Node.js 22+ *(vía B, manual)*

### 0. Configurar la conexión

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

Llena `DATABASE_URL` con la cadena de conexión del proyecto (Dashboard → Project Settings →
Database → Connection string), las dos llaves de API (Project Settings → API) en `.env`, y las
mismas llaves con prefijo `VITE_` en `frontend/.env`. Ambos `.env` ya están en `.gitignore`.

### Vía A — Docker (recomendada, un comando)

```bash
./scripts/desplegar.sh dev levantar
```

Levanta backend (`http://localhost:8000`, hot reload) y frontend (`http://localhost:5173`, hot
reload). Sin base de datos local — los dos contenedores le hablan a Supabase remoto con las
credenciales del paso 0. Otras acciones: `bajar`, `reconstruir`, `registros`, `pruebas`, `estado`.
Para producción (nginx sirviendo el build en `:8080`): `./scripts/desplegar.sh prod levantar` — las
`VITE_*` son variables de *build*, cambiarlas exige `--build`, no basta reiniciar. `prod pruebas` no
existe (la imagen prod no tiene pytest ni npm) — las pruebas siempre corren con `dev pruebas`. Detalle
completo en `CLAUDE.md` §"Stack y cómo correrlo".

### Vía B — manual, sin Docker

```bash
cd backend && uv run uvicorn app.main:app --reload --port 8000    # terminal 1
cd frontend && npm install && npm run dev                          # terminal 2
```

### 1. Crear los esquemas

```bash
source .env    # o exporta DATABASE_URL a mano
psql "$DATABASE_URL" -f db/ddl/00_esquemas.sql
psql "$DATABASE_URL" -f db/ddl/01_persona_stub.sql
psql "$DATABASE_URL" -f db/ddl/02_tiempo.sql
psql "$DATABASE_URL" -f db/indices/01_indices.sql
```

Alternativa sin `psql`: pegar cada archivo, en el mismo orden, en el **SQL Editor** del dashboard
de Supabase.

### 2. Cargar parámetros de ejemplo

```bash
psql "$DATABASE_URL" -f db/ddl/03_parametros_ejemplo.sql
```

> Los valores son **de ejemplo**. Las políticas reales se cargan como parámetros en el despliegue y
> no forman parte del alcance de este proyecto.

### 3. Generar datos sintéticos

**Pendiente.** `tools/generador/` está vacío — es el entregable `E5` (`SCJ-GEN-01`), programado para
el 8 de septiembre. Una vez escrito, se invoca con `uv run python`, no con `python3` directo:

```bash
cd tools/generador
uv run python generar.py --personas 8 --meses 6 --semilla 42 --salida ../../db/seeds/
psql "$DATABASE_URL" -f ../../db/seeds/datos_sinteticos.sql
```

La semilla fija hace el conjunto reproducible: la misma semilla produce siempre los mismos datos.

### 4. Correr las consultas de validación

```bash
for f in db/consultas/validacion/*.sql; do echo "== $f"; psql "$DATABASE_URL" -f "$f"; done
```

---

## Estructura del repositorio

```
docs/00-contexto/    Documentos de entrada: el problema, la especificación, la frontera
docs/01-analisis/    Modelo conceptual, trazabilidad, preguntas abiertas
docs/02-modelo/      Modelo lógico, físico, normalización, diccionario de datos
docs/03-decisiones/  Un archivo por decisión de diseño, con las opciones descartadas
docs/04-pruebas/     Generador, consultas de validación y reporte, volumen, índices
docs/05-entrega/     Documento final, traspaso, retrospectiva, glosario
docs/06-actas/       Actas de las sesiones conjuntas
bitacora/            Una nota por sesión de trabajo
db/                  DDL, migraciones, consultas e índices
tools/generador/     Generador de datos sintéticos
diagramas/           Fuente en texto (Mermaid/PlantUML) e imágenes exportadas
backend/             API en FastAPI (módulo Personas y Usuarios implementado, ver CLAUDE.md)
frontend/            Interfaz web en Vite + React + TypeScript (módulo Personas y Usuarios)
diseno_paginas/      Diseño de pantallas ("Kairos"), referencia visual del frontend
scripts/             desplegar.sh — levanta backend + frontend con Docker Compose
```

> Este repositorio documenta la vía de diseño de base de datos y ahora también el backend y
> frontend que la exponen. La base de datos sigue siendo Supabase remoto — no hay servicio de
> base de datos local que levantar, ni en Docker ni fuera de él.

---

## Estado

| Hito | Fecha | Estado |
|---|---|---|
| Modelo conceptual y frontera acordados | 22 ago 2026 | **Vencido, sin evidencia registrada** — bitácora y `SCJ-ACT-01` sin llenar |
| Modelo lógico y decisiones de diseño | 28 ago 2026 | Pendiente — bloqueado por el hito anterior |
| Módulo Personas y Usuarios (backend + frontend) | — | Entregado 3 sep 2026 — **QA manual contra los 14 mockups pendiente** |
| Modelo físico y generador de datos | 8 sep 2026 | Pendiente |
| Consultas de validación | 11 sep 2026 | Pendiente |
| Vacaciones, reporte, volumen, índices | 25 sep 2026 | Pendiente |
| **Congelamiento del esquema** | 25 sep 2026 | Pendiente |
| Entrega final y traspaso | 2 oct 2026 | Pendiente |

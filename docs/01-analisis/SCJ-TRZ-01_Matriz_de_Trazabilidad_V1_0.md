# Matriz de trazabilidad

**Sistema de Control de Jornada**
Folio SCJ-TRZ-01 · Versión 1.0 · Agosto de 2026

Enlaza cada requisito de `SCJ-ESP-01` con la estructura del modelo que lo sostiene y la consulta
que lo demuestra.

> **Se llena sobre la marcha, no al final.** Un requisito sin fila es un requisito que nadie
> verificó. Una fila sin consulta es una afirmación sin prueba.

---

## I. Cómo se lee

| Columna | Qué contiene |
|---|---|
| **Requisito** | Sección de `SCJ-ESP-01` |
| **Qué exige** | El requisito en una línea |
| **Dónde vive** | Tabla, columna o restricción que lo sostiene |
| **Cómo se garantiza** | Restricción declarativa · disparador · aplicación · convención |
| **Consulta que lo prueba** | Archivo en `db/consultas/validacion/` |
| **Estado** | Pendiente · Implementado · Verificado |

---

## II. La matriz

| Requisito | Qué exige | Dónde vive | Cómo se garantiza | Consulta | Estado |
|---|---|---|---|---|---|
| III.1 | El número de marcas de un día cerrado es par | `tramo.marca_cierre_id` | No bloqueado por restricción — se deriva y se refleja en `dia.estado` | `01_paridad.sql` | Implementado |
| III.1 | Cada par de marcas forma un tramo | `tiempo.tramo` | `UNIQUE (marca_apertura_id)`, `UNIQUE (marca_cierre_id)` | | Implementado |
| III.2 | Un día impar se rellena con la jornada pactada de esa persona ese día | *(pendiente de programar — el disparador de cierre no existe todavía)* | | | Pendiente |
| III.2 | Un día impar queda bloqueado y entra a la cola de excepciones | `dia.estado = 'bloqueado'`, `tiempo.excepcion` | Aplicación (proceso de cierre diario) | | Implementado (estructura) |
| III.2 | Contar marcas incompletas por persona y periodo | `tiempo.tramo` filtrado por `marca_cierre_id IS NULL` | | | Pendiente (consulta) |
| III.3 | La jornada asignada tiene vigencia, no es atributo fijo | `jornada_asignada.vigencia` | `daterange` | | Implementado |
| III.3 | **Un cálculo pasado da el mismo resultado indefinidamente** | `jornada_asignada`, `tope_legal` | Sin `UPDATE` sobre vigencias pasadas (convención, no restricción de base todavía) | `03_calculo_historico.sql` | Pendiente (SCJ-DEC-04 sigue propuesta) |
| III.3 | El patrón semanal admite horario distinto por día | `patron_semanal` (una fila por `dia_semana`) | | | Implementado |
| III.3 | El patrón semanal admite jornada partida en varios bloques | `patron_semanal` (varias filas por `dia_semana`) | Aplicación — sin restricción que límite filas por día | | Implementado |
| III.4 | Los topes legales viven en tabla de vigencias, no como constantes | `tope_legal` | `UNIQUE (vigente_desde)` | | Implementado |
| III.4 | Se impide asignar jornada por encima del tope vigente | *(pendiente — necesita disparador que compare contra `tope_legal` vigente)* | | | Pendiente |
| III.4 | Un cálculo histórico usa el tope vigente entonces | `tope_legal.vigente_desde` | | `04_tope_vigente.sql` | Pendiente (consulta) |
| III.5 | El tiempo se clasifica en ordinario, reposición o extra | `clasificacion_de_tiempo.tipo` | Disparador pendiente de programar (compara contra `tope_legal` y `banco_de_horas`) | | Pendiente |
| III.5 | La clasificación es posterior a la marca y puede corregirse sin perder historia | `clasificacion_de_tiempo` referencia `tramo`, no `marca` directo | | | Implementado |
| III.6 | La deuda se salda dentro de una ventana configurable | `parametro` (`ventana_banco_meses`) | | | Implementado (valor de ejemplo) |
| III.6 | Descontar y condonar exigen motivo y autor permanentes | `movimiento_de_saldo.motivo`, `.autor_id` | `CHECK` no fuerza `autor_id` no nulo por tipo todavía | | Implementado (parcial) |
| III.6 | Los umbrales son porcentaje de la jornada de la persona, no número fijo | `parametro` (`umbral_aviso_pct`, `umbral_escalamiento_pct`) | | | Implementado (valor de ejemplo) |
| III.6 | Se alerta también por antigüedad del saldo | `banco_de_horas.vivo_desde` | | | Implementado (estructura, sin proceso de alerta) |
| III.6 | **No existe saldo a favor** | `movimiento_de_saldo` tipo `generado_quincena` sólo se inserta si `horas_esperadas > horas_trabajadas` | Aplicación | | Implementado (regla, no restricción de base) |
| III.7 | **Una marca nunca se modifica ni se elimina** | `tiempo.marca` | Sin `UPDATE`/`DELETE` en ningún flujo (convención de aplicación, no permiso revocado en la base) | | Implementado (parcial — ver `SCJ-MOD-03 §V`) |
| III.7 | **Se reconstruye el estado del registro en cualquier momento del pasado** | `tiempo.correccion` | | `05_reconstruccion_historica.sql` | Pendiente (consulta) |
| III.8 | Una ausencia puede abarcar uno o varios días | `ausencia.fecha_inicio`, `.fecha_fin` | `CHECK (fecha_fin >= fecha_inicio)` | | Implementado |
| III.8 | Flujo de autorización de varios pasos, configurable | *(no implementado — `estado_autorizacion` es placeholder de un paso)* | | | Pendiente (`SCJ-DEC-05`) |
| III.8 | Saldo de vacaciones derivado de antigüedad, con tabla configurable | *(no implementado)* | | | Pendiente |
| III.8 | Detección de traslape entre personas de un mismo grupo | *(no implementado)* | | | Pendiente |
| III.9 | **Ninguna regla de negocio codificada.** Todas en tabla de parámetros | `tiempo.parametro` | | | Implementado |
| IV | Cada marca conserva hora del terminal y hora de recepción | `marca.momento_terminal`, `.momento_servidor` | | | Implementado |
| IV | Una marca con reloj no sincronizado entra ya señalada | `marca.reloj_sincronizado`, `.requiere_revision` | Disparador pendiente de programar (`requiere_revision = NOT reloj_sincronizado`) | | Implementado (estructura) |
| IV | **Se descartan duplicados por terminal + secuencia** | `marca` | `UNIQUE (evento_id)`; `uq_marca_terminal_secuencia` parcial | | Implementado |
| IV | El orden de llegada no determina el orden de los eventos | `marca.momento_terminal` vs. `.momento_servidor` | | | Implementado |

---

## III. Requisitos sin cobertura

Los que al cierre del proyecto no tengan consulta que los pruebe. **Se listan aquí en lugar de
esconderse.**

| Requisito | Por qué no se cubrió |
|---|---|
| | |

---

*Matriz de trazabilidad · Folio SCJ-TRZ-01 · V1.0*

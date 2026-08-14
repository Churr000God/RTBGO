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
| III.1 | El número de marcas de un día cerrado es par | | | | Pendiente |
| III.1 | Cada par de marcas forma un tramo | | | | Pendiente |
| III.2 | Un día impar se rellena con la jornada pactada de esa persona ese día | | | | Pendiente |
| III.2 | Un día impar queda bloqueado y entra a la cola de excepciones | | | | Pendiente |
| III.2 | Contar marcas incompletas por persona y periodo | | | | Pendiente |
| III.3 | La jornada asignada tiene vigencia, no es atributo fijo | | | | Pendiente |
| III.3 | **Un cálculo pasado da el mismo resultado indefinidamente** | | | | Pendiente |
| III.3 | El patrón semanal admite horario distinto por día | | | | Pendiente |
| III.3 | El patrón semanal admite jornada partida en varios bloques | | | | Pendiente |
| III.4 | Los topes legales viven en tabla de vigencias, no como constantes | | | | Pendiente |
| III.4 | Se impide asignar jornada por encima del tope vigente | | | | Pendiente |
| III.4 | Un cálculo histórico usa el tope vigente entonces | | | | Pendiente |
| III.5 | El tiempo se clasifica en ordinario, reposición o extra | | | | Pendiente |
| III.5 | La clasificación es posterior a la marca y puede corregirse sin perder historia | | | | Pendiente |
| III.6 | La deuda se salda dentro de una ventana configurable | | | | Pendiente |
| III.6 | Descontar y condonar exigen motivo y autor permanentes | | | | Pendiente |
| III.6 | Los umbrales son porcentaje de la jornada de la persona, no número fijo | | | | Pendiente |
| III.6 | Se alerta también por antigüedad del saldo | | | | Pendiente |
| III.6 | **No existe saldo a favor** | | | | Pendiente |
| III.7 | **Una marca nunca se modifica ni se elimina** | | | | Pendiente |
| III.7 | **Se reconstruye el estado del registro en cualquier momento del pasado** | | | | Pendiente |
| III.8 | Una ausencia puede abarcar uno o varios días | | | | Pendiente |
| III.8 | Flujo de autorización de varios pasos, configurable | | | | Pendiente |
| III.8 | Saldo de vacaciones derivado de antigüedad, con tabla configurable | | | | Pendiente |
| III.8 | Detección de traslape entre personas de un mismo grupo | | | | Pendiente |
| III.9 | **Ninguna regla de negocio codificada.** Todas en tabla de parámetros | | | | Pendiente |
| IV | Cada marca conserva hora del terminal y hora de recepción | | | | Pendiente |
| IV | Una marca con reloj no sincronizado entra ya señalada | | | | Pendiente |
| IV | **Se descartan duplicados por terminal + secuencia** | | | | Pendiente |
| IV | El orden de llegada no determina el orden de los eventos | | | | Pendiente |

---

## III. Requisitos sin cobertura

Los que al cierre del proyecto no tengan consulta que los pruebe. **Se listan aquí en lugar de
esconderse.**

| Requisito | Por qué no se cubrió |
|---|---|
| | |

---

*Matriz de trazabilidad · Folio SCJ-TRZ-01 · V1.0*

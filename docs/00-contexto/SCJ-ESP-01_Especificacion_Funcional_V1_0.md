# Especificación funcional — Subsistema de Tiempo

**Sistema de Control de Jornada · Especificación de datos**
Folio SCJ-ESP-01 · Versión 1.0 · Agosto de 2026

Define **qué debe poder representar el modelo de datos**, sin prescribir cómo. Es el documento de
entrada del proyecto: todo lo que se diseña responde a algún requisito de aquí.

> Todos los valores de configuración que aparecen son **ejemplos**, no valores de operación.

---

## I. Contexto

Sistema de registro y cálculo de jornada laboral para una empresa de **ocho empleados** en México.
Sustituye un control que hoy se lleva de forma verbal, sin registro. Ver `SCJ-CTX-01`.

El sistema se compone de dos subsistemas con una frontera explícita:

| Subsistema | Contenido | Alcance de este documento |
|---|---|---|
| **Personas** | Identidad, expediente, puestos, usuarios, permisos, compensación | Fuera |
| **Tiempo** | Marcas, jornadas, saldos, ausencias | **Este documento** |

### La frontera

El subsistema de Tiempo referencia a las personas **exclusivamente por un identificador opaco**
(`persona_id`).

> **Ninguna tabla del subsistema de Tiempo contiene nombre, CURP, RFC, NSS, salario ni ningún otro
> atributo de identidad.** Si un requisito parece necesitarlo, el requisito está mal planteado.

Implementación: dos esquemas separados en PostgreSQL. El subsistema de Tiempo recibe un stub
`persona(id)` y nada más. Detalle en `SCJ-FRO-01`.

---

## II. Origen de los datos

Un **terminal de registro** montado en pared identifica a la persona y produce **marcas**. El
terminal:

- Opera sin conexión y sincroniza después. Las marcas pueden llegar **fuera de orden y con retraso**
- Mantiene un reloj propio por hardware, que **puede estar desincronizado**
- Asigna a cada marca un **número de secuencia local monotónico**
- **Nunca elimina ni edita una marca**

El método de identificación es irrelevante para el modelo: el subsistema de Tiempo recibe un
`persona_id` opaco. Ningún dato de identificación cruza la frontera. Contrato completo en
`SCJ-CDT-01`.

Volumen esperado: ocho personas × cuatro marcas diarias ≈ **32 eventos al día**. El volumen no es
una restricción de diseño; la **integridad temporal** sí.

---

## III. El modelo de tiempo

### III.1 Regla de paridad

**Las marcas no tienen tipo.** No existe "marca de salida a comer". Sólo hay marcas, ordenadas
cronológicamente dentro de un día. El sistema las empareja: **la impar abre, la par cierra.**

Cada par forma un **tramo trabajado**. La suma de los tramos es la jornada del día.

**Consecuencia:** las pausas —comida, ausencias intermedias— no se registran como eventos: son **el
hueco entre tramos**. Por eso el mismo modelo sirve para pausas de treinta minutos y para
interrupciones de seis horas.

Ejemplos del mismo molde, sin ninguna regla especial:

| Caso | Marcas | Tramos |
|---|---|---|
| Jornada continua | 2 | 1 |
| Jornada con una pausa | 4 | 2 |
| Jornada con dos pausas | 6 | 3 |

**Invariante: el número de marcas de un día cerrado siempre es par.**

### III.2 Marcas incompletas

Si al cierre del día el número de marcas es **impar**:

1. Se descarta cualquier excedente
2. Se registra la jornada en su **valor pactado para esa persona ese día**
3. El día queda **bloqueado** para procesamiento posterior
4. El caso entra a una **cola de excepciones** para revisión humana

Funciona igual si falta la primera marca, la última, o una intermedia.

**Requisito adicional:** el sistema debe poder contar los eventos de marca incompleta **por persona
y por periodo**, para detectar patrones.

> **Restricción de diseño:** el valor de relleno **no es una constante**. Es la jornada pactada de
> esa persona ese día, que se obtiene del modelo de jornadas con vigencia (III.3).

### III.3 Jornada asignada con vigencia

Cada persona tiene una **jornada semanal asignada**, que **no es un atributo fijo**: es un registro
con vigencia. *De tal fecha a tal fecha, esta persona tuvo esta jornada.*

Cada cambio abre un renglón nuevo y cierra el anterior.

**Requisito duro:** el cálculo de cualquier periodo pasado debe dar **el mismo resultado
indefinidamente**, aunque la jornada de la persona haya cambiado varias veces desde entonces.

Además, la jornada define el **patrón semanal**: qué días se trabaja, con qué horario y con qué
pausas. Debe poder representar:

- Jornadas uniformes de lunes a viernes con un día distinto
- Jornadas personalizadas con horario diferente por día
- Jornadas partidas en varios bloques dentro del mismo día
- Jornadas sin pausa registrada

### III.4 Topes legales con vigencia anual

La legislación mexicana establece un **máximo de horas semanales que cambia en fecha fija**:

| Vigencia | Máximo semanal | Máximo de horas extra semanales |
|---|---:|---:|
| Hasta 2026 | 48 h | 9 h |
| Desde 2027 | 46 h | 9 h |
| Desde 2028 | 44 h | 10 h |
| Desde 2029 | 42 h | 11 h |
| Desde 2030 | 40 h | 12 h |

**Requisitos:**
- Los topes viven en una **tabla de vigencias**, nunca como constantes
- El sistema **impide asignar** una jornada por encima del tope vigente en la fecha de inicio
- Un cálculo histórico usa el tope que estaba vigente **entonces**, no el actual

### III.5 Tipos de tiempo

Todo tiempo trabajado se clasifica en uno de tres tipos:

| Tipo | Definición | Efecto |
|---|---|---|
| **Ordinario** | Dentro de la jornada pactada | Neutro |
| **Reposición** | Salda una deuda previa | Neutro — reduce el saldo |
| **Extra** | Por encima de la jornada, sin deuda previa | Genera obligación de pago |

**Regla de asignación automática:** si la persona tiene deuda, el tiempo excedente es
**reposición**; si no la tiene, es **extra**.

**Restricción:** la clasificación **no ocurre en el momento de la marca**. El terminal sólo sabe que
alguien se identificó. El tipo se determina después, y puede ser **revisado y corregido**. El modelo
debe soportar que una misma porción de tiempo cambie de clasificación sin perder su historia.

### III.6 Banco de horas

Cuando una persona trabaja menos que su jornada asignada, acumula **deuda**. La deuda debe saldarse
dentro de una **ventana de tiempo configurable** *(ejemplo: seis meses)*.

**Salidas posibles de un saldo:**

| Salida | Efecto en el saldo | Efecto en la compensación |
|---|---|---|
| **Cubrir** | Disminuye al trabajar las horas | Ninguno |
| **Arrastrar** | Pasa al periodo siguiente | Ninguno |
| **Descontar** | Se cancela | Ajuste a la baja |
| **Condonar** | Se cancela | Ninguno |

**Requisitos:**
- Descontar y condonar exigen **motivo escrito y autor**, conservados de forma permanente
- Los umbrales de alerta se calculan como **porcentaje de la jornada semanal de cada persona**, no
  como número fijo *(ejemplo: aviso al 100%, escalamiento al 200%)*
- También se alerta por **antigüedad del saldo** dentro de la ventana, no sólo por magnitud
- **No existe saldo a favor.** El excedente sin deuda previa se resuelve como tiempo extra en el
  momento; no se acumula como crédito

> **Pregunta de diseño abierta:** ¿el saldo se calcula al vuelo sobre las marcas, o se materializa y
> se actualiza incrementalmente? Hay argumentos válidos de los dos lados. La decisión y su
> justificación son un entregable → `SCJ-DEC-02`.

### III.7 Correcciones

Una marca registrada **nunca se modifica ni se elimina**.

Una corrección es un **registro nuevo que apunta a la marca original** y contiene: el valor
corregido, el motivo, el autor y el momento de la corrección.

**Requisito:** debe poder reconstruirse el estado del registro **tal como era en cualquier momento
del pasado**, junto con la cadena completa de correcciones aplicadas.

→ `SCJ-DEC-03`

### III.8 Ausencias

El modelo debe representar ausencias de distintas naturalezas, con efectos distintos sobre el
cálculo de jornada y sobre la compensación:

- Vacaciones
- Permiso con goce
- Permiso sin goce
- Incapacidad médica
- Falta

**Requisitos:**
- Una ausencia puede abarcar **uno o varios días**
- Debe soportar un **flujo de autorización de varios pasos**, configurable → `SCJ-DEC-05`
- El saldo de vacaciones se calcula a partir de la **antigüedad de la persona**, con una tabla de
  correspondencia configurable *(ejemplo: 12 días el primer año, creciendo hasta un tope)*
- Debe poder detectarse el **traslape de ausencias** entre personas de un mismo grupo

### III.9 Parámetros de configuración

**Ninguna regla de negocio se codifica.** Todas viven en una tabla de parámetros consultable y
editable.

Ejemplos de lo que debe ser parámetro: tolerancia antes de considerar retardo, hora de corte del
día, duración de la ventana del banco de horas, umbrales de alerta, tabla de días de vacaciones por
antigüedad, descuento fijo de pausa cuando no se registra.

> **Este requisito es el que permite que el modelo se construya antes de que las políticas estén
> decididas.** Es una restricción de arquitectura, no una comodidad.

---

## IV. Integridad temporal

En un sistema de jornada, **la hora es el dato**. Cada marca debe conservar:

| Campo | Propósito |
|---|---|
| Hora reportada por el terminal | El dato primario |
| Hora de llegada al servidor | Detectar retrasos de sincronización |
| Estado de sincronización del reloj del terminal | Señalar marcas de fiabilidad dudosa |
| Identificador del terminal | Trazabilidad, y soporte para varios dispositivos |
| Número de secuencia local | Orden real de los eventos e idempotencia |

**Requisitos:**
- Una marca con reloj no sincronizado entra **ya señalada** para revisión
- El servidor **descarta duplicados** por la pareja terminal + número de secuencia, de modo que
  reintentar la sincronización nunca genere marcas repetidas
- El orden de llegada **no** determina el orden de los eventos

---

## V. Entregables

| # | Entregable | Documento |
|---|---|---|
| **E1** | Modelo conceptual del sistema completo *(trabajo conjunto)* | `SCJ-MOD-01` |
| **E2** | Modelo lógico con normalización justificada | `SCJ-MOD-02`, `SCJ-NRM-01` |
| **E3** | Modelo físico: DDL, tipos, restricciones, índices | `SCJ-MOD-03` |
| **E4** | Decisiones de diseño, con argumentos de ambos lados | `SCJ-DEC-01` a `SCJ-DEC-05` |
| **E5** | Generador de datos sintéticos | `SCJ-GEN-01` |
| **E6** | Consultas de validación | `SCJ-CVA-01` |

### E4 · Las preguntas que hay que responder por escrito

1. ¿La restricción de paridad se valida con restricción declarativa, con disparador o en la aplicación?
2. ¿El saldo del banco de horas se calcula al vuelo o se materializa?
3. ¿Cómo se modela la corrección sin alterar el registro original — versionado, tabla de auditoría o registro de eventos?
4. ¿Cómo se representan las vigencias temporales, y cómo se garantiza que no se traslapen?
5. ¿Cómo se modela un flujo de autorización de pasos variables sin cablear ninguno?

**No basta con decir qué se eligió.** Cada una lleva las opciones consideradas, los argumentos de
los dos lados, la decisión y su consecuencia.

### E5 · Los casos difíciles que el generador debe producir a propósito

- Días con número impar de marcas
- Jornadas personalizadas con horario partido
- Deuda acumulada y episodios de reposición
- Marcas que llegan fuera de orden
- Marcas con reloj no sincronizado
- Correcciones aplicadas sobre marcas existentes
- Ausencias de cada tipo, incluyendo traslapes

> Los datos sintéticos son el **único** conjunto de datos con el que se trabaja. Nombres inventados,
> identificadores arbitrarios.

### E6 · Lo que las consultas deben demostrar

Horas trabajadas en un periodo · saldo del banco de horas **a una fecha dada del pasado** · días con
marcas incompletas · tiempo desglosado por tipo · **reconstrucción del estado histórico de un
registro corregido**.

La última es la más exigente y la que demuestra que el modelo de correcciones funciona.

---

## VI. Restricciones de trabajo

- **Sin acceso a datos reales.** Únicamente datos sintéticos generados por E5
- **Sin acceso a ningún entorno de operación**
- **Las políticas internas no forman parte del alcance.** Los valores de este documento son
  ejemplos; los reales se cargan como parámetros en el despliegue
- La presentación usa **nombre de empresa genérico y personas ficticias**

---

*Especificación funcional · Folio SCJ-ESP-01 · V1.0*

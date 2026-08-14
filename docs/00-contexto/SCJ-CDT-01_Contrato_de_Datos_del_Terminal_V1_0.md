# Contrato de datos del terminal

**Sistema de Control de Jornada**
Folio SCJ-CDT-01 · Versión 1.0 · Agosto de 2026

Qué envía el terminal al servidor, con qué formato y con qué garantías. **Es el contrato: ninguno
de los dos lados lo cambia sin avisar al otro.**

> **Estado: borrador.** Pendiente de confirmación final del responsable del terminal. Los nombres de
> campo pueden ajustarse; **la semántica y las garantías no.**

---

## I. El terminal, en cuatro hechos

1. **Opera sin conexión.** Guarda las marcas localmente y las envía cuando hay red
2. **Tiene reloj propio**, que puede estar desincronizado
3. **Numera sus marcas** con una secuencia local monotónica que nunca se reinicia
4. **Nunca borra ni edita una marca.** Sólo la envía y espera confirmación

De ahí salen las tres propiedades que el modelo debe soportar: **retraso, desorden y duplicación**.

---

## II. Estructura de una marca

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `terminal_id` | texto | Sí | Identificador del terminal. Ejemplo: `TERM-01` |
| `secuencia` | entero | Sí | Número local monotónico. Único dentro del terminal, nunca se reinicia |
| `persona_id` | entero | Sí | **Identificador opaco.** Ningún otro atributo de la persona viaja |
| `hora_terminal` | instante con zona | Sí | Hora que el terminal cree que es. **El dato primario** |
| `reloj_sincronizado` | booleano | Sí | `false` si el terminal no logró sincronizar antes de la marca |
| `desviacion_reloj_s` | entero | No | Segundos de desviación conocidos, si el terminal pudo medirla |
| `origen` | enumerado | Sí | `terminal` · `contingencia` · `captura_manual` |

### El campo `origen`

| Valor | Significa |
|---|---|
| `terminal` | Marca normal, producida por el aparato en pared |
| `contingencia` | Producida por el mecanismo alterno cuando el terminal está fuera de servicio |
| `captura_manual` | Registrada por una persona autorizada. **Siempre lleva motivo y autor** |

> **Las marcas de contingencia y de captura manual quedan etiquetadas como tales de forma
> permanente.** No se convierten en marcas normales al pasar el tiempo.

---

## III. Lo que agrega el servidor

Estos campos **no viajan**: los pone el servidor al recibir.

| Campo | Descripción |
|---|---|
| `hora_recepcion` | Instante en que el servidor recibió la marca. Permite medir el retraso de sincronización |
| `id` | Identificador interno de la marca |
| `requiere_revision` | Se marca en `true` automáticamente si `reloj_sincronizado` es `false` |

---

## IV. Envío por lotes

El terminal envía **lotes** de una o más marcas y espera confirmación **individual** de cada una.

```json
{
  "terminal_id": "TERM-01",
  "enviado_en": "2026-09-14T18:03:22-06:00",
  "marcas": [
    {
      "secuencia": 10482,
      "persona_id": 3,
      "hora_terminal": "2026-09-14T08:01:47-06:00",
      "reloj_sincronizado": true,
      "origen": "terminal"
    },
    {
      "secuencia": 10483,
      "persona_id": 6,
      "hora_terminal": "2026-09-14T08:04:12-06:00",
      "reloj_sincronizado": false,
      "desviacion_reloj_s": 214,
      "origen": "terminal"
    }
  ]
}
```

Respuesta:

```json
{
  "resultados": [
    { "secuencia": 10482, "estado": "aceptada", "id": 55910 },
    { "secuencia": 10483, "estado": "duplicada", "id": 55700 }
  ]
}
```

| Estado | Significa | Qué hace el terminal |
|---|---|---|
| `aceptada` | Se creó la marca | La borra de su cola local |
| `duplicada` | Ya existía esa pareja terminal + secuencia | La borra de su cola local |
| `rechazada` | Datos inválidos o persona desconocida | La conserva y la reporta |

---

## V. Garantías del contrato

**Las cinco cosas de las que el modelo puede depender:**

| # | Garantía |
|---|---|
| 1 | La pareja `(terminal_id, secuencia)` es **única para siempre**. Es la clave de idempotencia |
| 2 | La secuencia es **monotónica creciente** dentro de un terminal, y nunca se reinicia |
| 3 | Un mismo lote puede llegar **varias veces**. Reenviarlo nunca crea marcas duplicadas |
| 4 | `hora_terminal` puede ser **anterior o posterior** a la de una marca con secuencia mayor |
| 5 | El terminal **nunca** envía una modificación ni un borrado. Sólo altas |

**Lo que el contrato NO garantiza:**

- Que las marcas lleguen en orden
- Que lleguen el mismo día en que se produjeron
- Que `hora_terminal` sea correcta
- Que el número de marcas de un día sea par

> **La cuarta es la que obliga a que el orden de los eventos se determine por `hora_terminal` y
> `secuencia`, y nunca por el orden de llegada.**

---

## VI. Lo que nunca cruza

El terminal envía `persona_id` y nada más sobre la persona.

**No viaja:** nombre, fotografía, plantilla de identificación, ni ningún dato biométrico. El método
por el cual el terminal reconoce a la persona vive dentro del terminal y es invisible para el
subsistema de Tiempo.

Ver `SCJ-FRO-01`.

---

*Contrato de datos del terminal · Folio SCJ-CDT-01 · V1.0*

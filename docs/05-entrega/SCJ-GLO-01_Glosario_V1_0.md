# Glosario

**Sistema de Control de Jornada**
Folio SCJ-GLO-01 · Versión 1.0 · Agosto de 2026

Términos del dominio, con el significado exacto que tienen en este proyecto.

> **Se llena desde el primer día.** Un término que se usa con dos significados distintos en dos
> documentos es un error que se detecta aquí y en ningún otro lado.

---

| Término | Definición |
|---|---|
| **Marca** | Evento producido por el terminal cuando una persona se identifica. **No tiene tipo:** no existe "marca de entrada" ni "marca de salida". Es inmutable |
| **Tramo** | Par de marcas consecutivas: la impar abre, la par cierra. Unidad de tiempo trabajado |
| **Jornada** | Suma de los tramos de un día. También, la jornada **asignada**: el horario pactado con vigencia |
| **Paridad** | Invariante según el cual el número de marcas de un día cerrado es par |
| **Día impar** | Día cuyo número de marcas es impar. Se rellena con la jornada pactada, se bloquea y entra a la cola de excepciones |
| **Vigencia** | Rango de fechas durante el cual un registro es el aplicable. Un cálculo pasado usa la vigencia de entonces |
| **Tope legal** | Máximo de horas semanales que la ley permite. Cambia en fecha fija y vive en tabla de vigencias |
| **Tiempo ordinario** | Tiempo trabajado dentro de la jornada pactada. Efecto neutro |
| **Tiempo de reposición** | Tiempo por encima de la jornada que salda una deuda previa. Reduce el saldo, no genera pago |
| **Tiempo extra** | Tiempo por encima de la jornada sin deuda previa. Genera obligación de pago |
| **Banco de horas** | Mecanismo de acumulación y resolución de deuda dentro de una ventana configurable |
| **Deuda** | Diferencia negativa entre lo trabajado y la jornada asignada |
| **Ventana** | Periodo dentro del cual una deuda debe resolverse. Ejemplo: seis meses |
| **Cubrir / arrastrar / descontar / condonar** | Las cuatro salidas posibles de un saldo |
| **Saldo a favor** | **No existe.** El excedente sin deuda previa se resuelve como tiempo extra en el momento |
| **Corrección** | Registro nuevo que apunta a una marca original. La marca **nunca** se modifica |
| **Excepción** | Caso que requiere revisión humana: día impar, reloj desincronizado, saldo vencido |
| **Persona_id** | Identificador opaco. **Lo único que cruza la frontera** entre subsistemas |
| **Frontera** | Límite entre el subsistema de Personas y el de Tiempo. Ver `SCJ-FRO-01` |
| **Terminal** | Aparato montado en pared que identifica a la persona y produce marcas |
| **Marcha en vacío** | Periodo en que el sistema registra sin aplicar consecuencias |
| **Parámetro** | Valor de política que vive en tabla, no en código. **Ninguna regla de negocio se codifica** |
| **Datos sintéticos** | El único conjunto de datos con el que se trabaja. Generado con semilla fija |

---

*Glosario · Folio SCJ-GLO-01 · V1.0*

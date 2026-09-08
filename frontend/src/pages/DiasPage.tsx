import { Fragment, useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, Search } from "lucide-react";

import { apiFetch } from "../lib/apiClient";
import { AppShell } from "../layouts/AppShell";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Input } from "../components/Input";

// Debounce del buscador de persona: mismo criterio que TramosPage — es el único filtro sin
// precedente de "dispara al toque".
const DEBOUNCE_BUSQUEDA_MS = 300;
const LIMITE = 20;
const COLUMNAS = 12;

type EstadoDia = "abierto" | "cerrado" | "bloqueado" | "revisado";

type Dia = {
  id: number;
  fecha: string;
  persona_id: string;
  persona_nombre: string | null;
  estado: EstadoDia;
  horas_totales: number | null;
  origen: "automatico_confianza" | "ausencia_autorizada" | null;
  primera_marca: string | null;
  ultima_marca: string | null;
  alerta_entrada: "retardo" | "entrada_anticipada" | null;
  alerta_salida: "salida_anticipada" | "salida_tardia" | null;
  excepciones_pendientes: number;
};

type RespuestaDias = { total: number; dias: Dia[] };

type EstadoCarga = "cargando" | "listo" | "error";

type Orden = "fecha_desc" | "fecha_asc" | "horas_desc" | "horas_asc";

function formatearFecha(fecha: string): string {
  const valor = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(valor.getTime())) return "—";
  return valor.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function formatearHora(fecha: string | null): string {
  if (!fecha) return "—";
  const valor = new Date(fecha);
  if (Number.isNaN(valor.getTime())) return "—";
  return valor.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function formatearHorasTotales(horas: number | null): string {
  if (horas === null) return "—";
  const totalMinutos = Math.round(horas * 60);
  const h = Math.floor(totalMinutos / 60);
  const m = totalMinutos % 60;
  return `${h}h ${m}m`;
}

async function mensajeDeError(respuesta: Response, generico: string): Promise<string> {
  try {
    const cuerpo = await respuesta.json();
    if (typeof cuerpo?.detail === "string") return cuerpo.detail;
  } catch {
    // cuerpo no era JSON legible — cae al genérico
  }
  return generico;
}

// Mismo patrón literal que TramosPage.tsx: "abierto"/"cerrado" son el ciclo de vida normal del
// día, sin badge — sólo "bloqueado" (SCJ-DEC-06) y "revisado" son desvíos con aviso visual.
const ETIQUETA_ESTADO: Partial<Record<EstadoDia, string>> = {
  bloqueado: "Bloqueado — necesita revisión",
  revisado: "Revisado",
};

const VARIANTE_ESTADO: Partial<Record<EstadoDia, "peligro" | "exito">> = {
  bloqueado: "peligro",
  revisado: "exito",
};

const ETIQUETA_ESTADO_FILTRO: Record<EstadoDia, string> = {
  abierto: "Abierto",
  cerrado: "Cerrado",
  bloqueado: "Bloqueado",
  revisado: "Revisado",
};

const ETIQUETA_ORIGEN: Record<"automatico_confianza" | "ausencia_autorizada", string> = {
  automatico_confianza: "Automático (confianza)",
  ausencia_autorizada: "Ausencia autorizada",
};

const ETIQUETA_ALERTA_ENTRADA: Record<"retardo" | "entrada_anticipada", string> = {
  retardo: "Retardo",
  entrada_anticipada: "Entrada anticipada",
};

const ETIQUETA_ALERTA_SALIDA: Record<"salida_anticipada" | "salida_tardia", string> = {
  salida_anticipada: "Salida anticipada",
  salida_tardia: "Salida tardía",
};

export function DiasPage() {
  const [dias, setDias] = useState<Dia[]>([]);
  const [total, setTotal] = useState(0);
  const [estadoCarga, setEstadoCarga] = useState<EstadoCarga>("cargando");
  const [busqueda, setBusqueda] = useState("");
  const [busquedaDebounced, setBusquedaDebounced] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<EstadoDia | "">("");
  const [orden, setOrden] = useState<Orden>("fecha_desc");
  const [desplazamiento, setDesplazamiento] = useState(0);
  // Mismo propósito que TramosPage: con debounce + filtros encadenados las respuestas pueden
  // llegar fuera de orden — sólo la más nueva gana.
  const cargaEnCursoRef = useRef(0);

  const [pendienteRevisarId, setPendienteRevisarId] = useState<number | null>(null);
  const [errorRevisar, setErrorRevisar] = useState<string | null>(null);
  const [revisando, setRevisando] = useState(false);
  const [valorHoras, setValorHoras] = useState("");

  useEffect(() => {
    const id = setTimeout(() => {
      setBusquedaDebounced(busqueda.trim());
      setDesplazamiento(0);
    }, DEBOUNCE_BUSQUEDA_MS);
    return () => clearTimeout(id);
  }, [busqueda]);

  function cargar() {
    const params = new URLSearchParams();
    if (busquedaDebounced) params.set("busqueda_persona", busquedaDebounced);
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    if (filtroEstado) params.set("estado", filtroEstado);
    params.set("orden", orden);
    params.set("limite", String(LIMITE));
    params.set("desplazamiento", String(desplazamiento));

    const idCarga = ++cargaEnCursoRef.current;
    setEstadoCarga("cargando");
    apiFetch(`/api/dias?${params.toString()}`)
      .then((respuesta) => {
        if (!respuesta.ok) throw new Error(`status ${respuesta.status}`);
        return respuesta.json();
      })
      .then((datos: RespuestaDias) => {
        if (idCarga !== cargaEnCursoRef.current) return;
        setDias(datos.dias);
        setTotal(datos.total);
        setEstadoCarga("listo");
      })
      .catch(() => {
        if (idCarga !== cargaEnCursoRef.current) return;
        setEstadoCarga("error");
      });
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(cargar, [busquedaDebounced, desde, hasta, filtroEstado, orden, desplazamiento]);

  const hayFiltrosActivos = !!(busqueda || desde || hasta || filtroEstado);

  function limpiarFiltros() {
    setBusqueda("");
    setBusquedaDebounced("");
    setDesde("");
    setHasta("");
    setFiltroEstado("");
    setDesplazamiento(0);
  }

  function solicitarRevisar(id: number) {
    setPendienteRevisarId(id);
    setErrorRevisar(null);
    setValorHoras("");
  }

  function cancelarRevisar() {
    setPendienteRevisarId(null);
    setErrorRevisar(null);
    setValorHoras("");
  }

  const horasNumero = Number(valorHoras);
  const horasValidas = valorHoras !== "" && !Number.isNaN(horasNumero) && horasNumero >= 0 && horasNumero <= 24;

  async function confirmarRevisar() {
    if (pendienteRevisarId === null || !horasValidas) return;
    setRevisando(true);
    setErrorRevisar(null);
    try {
      const respuesta = await apiFetch(`/api/dias/${pendienteRevisarId}/revisar`, {
        method: "POST",
        body: JSON.stringify({ horas_totales: horasNumero }),
      });
      if (!respuesta.ok) {
        // 404 (día ya no existe) / 409 (ya no está bloqueado) / 422 (horas fuera de rango que el
        // form no atrapó) — la fila pudo envejecer entre la carga y el click. Se muestra el
        // motivo sin cerrar la confirmación, mismo criterio que DiasFestivosPage al eliminar:
        // cerrarla en silencio dejaría a la persona sin saber por qué no se marcó como revisado.
        setErrorRevisar(await mensajeDeError(respuesta, "No se pudo marcar el día como revisado."));
        return;
      }
      setPendienteRevisarId(null);
      setValorHoras("");
      cargar();
    } catch {
      setErrorRevisar("No se pudo marcar el día como revisado. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setRevisando(false);
    }
  }

  const paginaActual = Math.floor(desplazamiento / LIMITE) + 1;
  const hayPaginaAnterior = desplazamiento > 0;
  const hayPaginaSiguiente = desplazamiento + LIMITE < total;

  return (
    <AppShell>
      <div className="contenedor-pagina contenedor-pagina--ancho">
        <nav className="migas">
          <strong>Días</strong>
        </nav>
        <div className="encabezado-pagina">
          <div>
            <h1>Días</h1>
            <p className="subtitulo-pagina">
              Consulta por persona y fecha, con la primera y última marca efectivas (con
              corrección aplicada) y sus alertas de horario. Un día bloqueado necesita revisión
              manual — es la única transición que se puede hacer a mano.
            </p>
          </div>
        </div>

        <div className="barra-filtros">
          <div className="campo-con-icono">
            <Search size={16} className="icono-campo" aria-hidden="true" />
            <input
              type="search"
              placeholder="Buscar por persona"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              aria-label="Buscar por persona"
            />
          </div>
          <div className="grupo-filtros-secundarios">
            <Input
              id="filtro-dia-desde"
              label="Desde"
              type="date"
              value={desde}
              onChange={(evento) => {
                setDesde(evento.target.value);
                setDesplazamiento(0);
              }}
            />
            <Input
              id="filtro-dia-hasta"
              label="Hasta"
              type="date"
              value={hasta}
              onChange={(evento) => {
                setHasta(evento.target.value);
                setDesplazamiento(0);
              }}
            />
            <select
              value={filtroEstado}
              onChange={(evento) => {
                setFiltroEstado(evento.target.value as EstadoDia | "");
                setDesplazamiento(0);
              }}
              aria-label="Filtrar por estado"
            >
              <option value="">Estado: Todos</option>
              {(Object.keys(ETIQUETA_ESTADO_FILTRO) as EstadoDia[]).map((estado) => (
                <option key={estado} value={estado}>
                  {ETIQUETA_ESTADO_FILTRO[estado]}
                </option>
              ))}
            </select>
            <select
              value={orden}
              onChange={(evento) => {
                setOrden(evento.target.value as Orden);
                setDesplazamiento(0);
              }}
              aria-label="Ordenar por"
            >
              <option value="fecha_desc">Fecha: más recientes primero</option>
              <option value="fecha_asc">Fecha: más antiguas primero</option>
              <option value="horas_desc">Horas totales: mayor primero</option>
              <option value="horas_asc">Horas totales: menor primero</option>
            </select>
            {hayFiltrosActivos && (
              <Button type="button" onClick={limpiarFiltros}>
                Limpiar filtros
              </Button>
            )}
          </div>
        </div>

        {estadoCarga === "cargando" && (
          <p className="boton-con-icono">
            <Loader2 size={16} className="icono-girando" aria-hidden="true" />
            Cargando días…
          </p>
        )}

        {estadoCarga === "error" && (
          <div className="tarjeta-error" role="alert">
            <strong>
              <AlertCircle size={16} aria-hidden="true" />
              No se pudieron cargar los días
            </strong>
            <p>Ocurrió un problema al consultar los días.</p>
            <Button type="button" onClick={cargar}>
              Reintentar
            </Button>
          </div>
        )}

        {estadoCarga === "listo" && dias.length === 0 && (
          <div className="estado-vacio">
            <p>No hay días que coincidan con la búsqueda.</p>
          </div>
        )}

        {estadoCarga === "listo" && dias.length > 0 && (
          <>
            <div className="tabla-desplazable">
              <table>
                <thead>
                  <tr>
                    <th>Día</th>
                    <th>Persona</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                    <th>Horas totales</th>
                    <th>Origen</th>
                    <th>Primera marca</th>
                    <th>Última marca</th>
                    <th>Alerta entrada</th>
                    <th>Alerta salida</th>
                    <th>Excepciones</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {dias.map((dia) => (
                    <Fragment key={dia.id}>
                      <tr>
                        <td>{dia.id}</td>
                        <td>{dia.persona_nombre ?? "—"}</td>
                        <td>{formatearFecha(dia.fecha)}</td>
                        <td>
                          {(() => {
                            const variante = VARIANTE_ESTADO[dia.estado];
                            return variante ? (
                              <Badge variante={variante}>{ETIQUETA_ESTADO[dia.estado]}</Badge>
                            ) : (
                              "—"
                            );
                          })()}
                        </td>
                        <td>{formatearHorasTotales(dia.horas_totales)}</td>
                        <td>{dia.origen ? ETIQUETA_ORIGEN[dia.origen] : "—"}</td>
                        <td>{formatearHora(dia.primera_marca)}</td>
                        <td>{formatearHora(dia.ultima_marca)}</td>
                        <td>
                          {dia.alerta_entrada ? (
                            <Badge variante="aviso">{ETIQUETA_ALERTA_ENTRADA[dia.alerta_entrada]}</Badge>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          {dia.alerta_salida ? (
                            <Badge variante="aviso">{ETIQUETA_ALERTA_SALIDA[dia.alerta_salida]}</Badge>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          {dia.excepciones_pendientes > 0 ? (
                            <Badge variante="aviso">{dia.excepciones_pendientes} pendiente(s)</Badge>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          {dia.estado === "bloqueado" && (
                            <Button
                              type="button"
                              aria-label={`Marcar como revisado — ${dia.persona_nombre ?? "sin nombre"}, ${formatearFecha(dia.fecha)}`}
                              onClick={() => solicitarRevisar(dia.id)}
                            >
                              Marcar como revisado
                            </Button>
                          )}
                        </td>
                      </tr>
                      {pendienteRevisarId === dia.id && (
                        <tr>
                          <td colSpan={COLUMNAS}>
                            <p role="alert">
                              ¿Marcar como revisado el día de <strong>{dia.persona_nombre ?? "—"}</strong>{" "}
                              ({formatearFecha(dia.fecha)})?
                            </p>
                            <Input
                              id={`horas-revisar-${dia.id}`}
                              label="Horas trabajadas"
                              type="number"
                              min={0}
                              max={24}
                              step={0.25}
                              required
                              value={valorHoras}
                              onChange={(evento) => setValorHoras(evento.target.value)}
                            />
                            {errorRevisar && <p role="alert">{errorRevisar}</p>}
                            <div className="botonera">
                              <Button type="button" onClick={cancelarRevisar}>
                                Cancelar
                              </Button>
                              <Button
                                type="button"
                                variante="primario"
                                cargando={revisando}
                                textoCargando="Confirmando…"
                                disabled={!horasValidas}
                                onClick={confirmarRevisar}
                              >
                                Confirmar
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="pie-tabla">
              Mostrando {dias.length} de {total} días
            </p>
            <div className="botonera">
              <Button
                type="button"
                onClick={() => setDesplazamiento((actual) => Math.max(0, actual - LIMITE))}
                disabled={!hayPaginaAnterior}
              >
                Anterior
              </Button>
              <span className="ayuda-campo">Página {paginaActual}</span>
              <Button
                type="button"
                onClick={() => setDesplazamiento((actual) => actual + LIMITE)}
                disabled={!hayPaginaSiguiente}
              >
                Siguiente
              </Button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

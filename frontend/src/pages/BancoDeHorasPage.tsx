import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Search } from "lucide-react";

import { apiFetch } from "../lib/apiClient";
import { AppShell } from "../layouts/AppShell";
import { Badge } from "../components/Badge";

type BancoHoras = {
  persona_id: string;
  persona_nombre: string | null;
  monto: number;
  vivo_desde: string | null;
  actualizado_en: string;
};

type EstadoCarga = "cargando" | "listo" | "error";

// Top N de la gráfica de deuda — suficiente para ver quién concentra más horas sin abrumar la
// pantalla con una barra por persona si el padrón crece.
const TOPE_GRAFICA_DEUDA = 8;

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase();
}

function formatearFechaHora(fecha: string | null): string {
  if (!fecha) return "—";
  const valor = new Date(fecha);
  if (Number.isNaN(valor.getTime())) return "—";
  return valor.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BancoDeHorasPage() {
  const [saldos, setSaldos] = useState<BancoHoras[]>([]);
  const [estadoCarga, setEstadoCarga] = useState<EstadoCarga>("cargando");
  const [busqueda, setBusqueda] = useState("");

  function cargar() {
    setEstadoCarga("cargando");
    apiFetch("/api/banco-de-horas")
      .then((respuesta) => {
        if (!respuesta.ok) throw new Error(`status ${respuesta.status}`);
        return respuesta.json();
      })
      .then((datos: BancoHoras[]) => {
        setSaldos(datos);
        setEstadoCarga("listo");
      })
      .catch(() => setEstadoCarga("error"));
  }

  useEffect(() => {
    cargar();
  }, []);

  const filtrados = useMemo(() => {
    const consulta = normalizar(busqueda.trim());
    if (!consulta) return saldos;
    return saldos.filter((s) => normalizar(s.persona_nombre ?? "").includes(consulta));
  }, [saldos, busqueda]);

  const metricas = useMemo(() => {
    const enDeuda = saldos.filter((s) => s.monto > 0);
    return {
      totalPersonas: saldos.length,
      enDeuda: enDeuda.length,
      sinDeuda: saldos.length - enDeuda.length,
      horasAdeudadas: enDeuda.reduce((suma, s) => suma + s.monto, 0),
    };
  }, [saldos]);

  // "Sin saldo a favor" (subtítulo de la página) => sin deuda es siempre monto=0 para todos —
  // no hay una magnitud que rankear ahí, por eso ese grupo se muestra como lista, no como barras
  // (una barra sin longitud no comunica nada). El ranking con barras sólo tiene sentido para
  // quienes sí tienen deuda, donde el monto sí varía persona a persona.
  const topEnDeuda = useMemo(
    () => [...saldos].filter((s) => s.monto > 0).sort((a, b) => b.monto - a.monto).slice(0, TOPE_GRAFICA_DEUDA),
    [saldos],
  );
  const montoMaximoEnDeuda = topEnDeuda[0]?.monto ?? 0;
  const sinDeuda = useMemo(() => saldos.filter((s) => s.monto === 0), [saldos]);

  return (
    <AppShell>
      <div className="contenedor-pagina contenedor-pagina--ancho">
        <nav className="migas">
          <strong>Banco de horas</strong>
        </nav>
        <div className="encabezado-pagina">
          <div>
            <h1>Banco de horas</h1>
            <p className="subtitulo-pagina">
              Deuda de horas acumulada por persona. No existe saldo a favor — sólo deuda o cero.
            </p>
          </div>
        </div>

        {estadoCarga === "listo" && saldos.length > 0 && (
          <div className="banda-metricas">
            <div className="metrica">
              <span className="etiqueta-metrica">Personas con saldo</span>
              <strong>{metricas.totalPersonas}</strong>
            </div>
            <div className="metrica">
              <span className="etiqueta-metrica">
                <span className="punto punto--peligro" aria-hidden="true" />
                En deuda
              </span>
              <strong>{metricas.enDeuda}</strong>
              <span className="detalle-metrica">{metricas.horasAdeudadas.toFixed(2)} h acumuladas</span>
            </div>
            <div className="metrica">
              <span className="etiqueta-metrica">
                <span className="punto punto--exito" aria-hidden="true" />
                Sin deuda
              </span>
              <strong>{metricas.sinDeuda}</strong>
            </div>
          </div>
        )}

        {estadoCarga === "listo" && saldos.length > 0 && (
          <div className="rejilla-tarjetas">
            <div className="tarjeta-resumen">
              <h3>Top en deuda</h3>
              {topEnDeuda.length === 0 ? (
                <p>Nadie tiene horas en deuda ahora mismo.</p>
              ) : (
                <div className="grafica-barras">
                  {topEnDeuda.map((saldo) => (
                    <div className="fila-grafica-barras" key={saldo.persona_id}>
                      <span className="etiqueta-barra">{saldo.persona_nombre ?? "—"}</span>
                      <div className="pista-barra">
                        <div
                          className="relleno-barra"
                          style={{ transform: `scaleX(${saldo.monto / montoMaximoEnDeuda})` }}
                        />
                      </div>
                      <span className="valor-barra">{saldo.monto.toFixed(2)} h</span>
                    </div>
                  ))}
                </div>
              )}
              {metricas.enDeuda > topEnDeuda.length && (
                <p className="pie-tabla">y {metricas.enDeuda - topEnDeuda.length} persona(s) más en deuda</p>
              )}
            </div>

            <div className="tarjeta-resumen">
              <h3>Sin deuda</h3>
              {sinDeuda.length === 0 ? (
                <p>Nadie está sin deuda ahora mismo.</p>
              ) : (
                <div className="lista-chips-personas">
                  {sinDeuda.map((saldo) => (
                    <Badge variante="exito" key={saldo.persona_id}>
                      {saldo.persona_nombre ?? "—"}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="barra-filtros">
          <div className="campo-con-icono">
            <Search size={16} className="icono-campo" aria-hidden="true" />
            <input
              type="search"
              placeholder="Buscar por nombre"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              aria-label="Buscar por nombre"
            />
          </div>
        </div>

        {estadoCarga === "cargando" && (
          <p className="boton-con-icono">
            <Loader2 size={16} className="icono-girando" aria-hidden="true" />
            Cargando saldos…
          </p>
        )}

        {estadoCarga === "error" && (
          <div className="tarjeta-error" role="alert">
            <strong>
              <AlertCircle size={16} aria-hidden="true" />
              No se pudo cargar el banco de horas
            </strong>
            <p>Ocurrió un problema al consultar los saldos.</p>
            <button type="button" onClick={cargar}>
              Reintentar
            </button>
          </div>
        )}

        {estadoCarga === "listo" && filtrados.length === 0 && (
          <div className="estado-vacio">
            <p>No hay saldos que coincidan con la búsqueda.</p>
          </div>
        )}

        {estadoCarga === "listo" && filtrados.length > 0 && (
          <>
            <div className="tabla-desplazable">
              <table>
                <thead>
                  <tr>
                    <th>Persona</th>
                    <th>Saldo</th>
                    <th>En deuda desde</th>
                    <th>Actualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((saldo) => (
                    <tr key={saldo.persona_id}>
                      <td>{saldo.persona_nombre ?? "—"}</td>
                      <td>
                        <Badge variante={saldo.monto > 0 ? "peligro" : "exito"}>
                          {saldo.monto.toFixed(2)} h {saldo.monto > 0 ? "en deuda" : "sin deuda"}
                        </Badge>
                      </td>
                      <td>{formatearFechaHora(saldo.vivo_desde)}</td>
                      <td>{formatearFechaHora(saldo.actualizado_en)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="pie-tabla">
              Mostrando {filtrados.length} de {saldos.length} personas
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}

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

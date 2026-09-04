import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Plus, Search } from "lucide-react";

import { apiFetch } from "../lib/apiClient";
import { AppShell } from "../layouts/AppShell";

type Persona = {
  id: string;
  primer_nombre: string;
  apellido_paterno: string;
  estado: string;
  fecha_ingreso?: string;
  fecha_baja?: string | null;
};

type EstadoCarga = "cargando" | "listo" | "error";

const ETIQUETA_ESTADO: Record<string, string> = {
  activo: "Activo",
  suspension: "Suspensión",
  baja_definitiva: "Baja",
};

const CLASE_ESTADO: Record<string, string> = {
  activo: "insignia--exito",
  suspension: "insignia--aviso",
  baja_definitiva: "insignia--peligro",
};

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatearFecha(fecha?: string | null): string {
  if (!fecha) return "—";
  const valor = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(valor.getTime())) return "—";
  return valor.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function inicialesDe(persona: Persona): string {
  return `${persona.primer_nombre[0] ?? ""}${persona.apellido_paterno[0] ?? ""}`.toUpperCase();
}

export function DirectorioPersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [estadoCarga, setEstadoCarga] = useState<EstadoCarga>("cargando");
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  function cargar() {
    setEstadoCarga("cargando");
    apiFetch("/api/personas")
      .then((respuesta) => {
        if (!respuesta.ok) throw new Error(`status ${respuesta.status}`);
        return respuesta.json();
      })
      .then((datos: Persona[]) => {
        setPersonas(datos);
        setEstadoCarga("listo");
      })
      .catch(() => setEstadoCarga("error"));
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const metricas = useMemo(() => {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    return {
      total: personas.length,
      activos: personas.filter((p) => p.estado === "activo").length,
      suspension: personas.filter((p) => p.estado === "suspension").length,
      bajasDelMes: personas.filter((p) => {
        if (!p.fecha_baja) return false;
        const fecha = new Date(`${p.fecha_baja}T00:00:00`);
        return !Number.isNaN(fecha.getTime()) && fecha >= inicioMes;
      }).length,
    };
  }, [personas]);

  const filtradas = useMemo(() => {
    const consulta = normalizar(busqueda.trim());
    return personas.filter((persona) => {
      const coincideBusqueda =
        !consulta ||
        normalizar(`${persona.primer_nombre} ${persona.apellido_paterno}`).includes(consulta);
      const coincideEstado = !filtroEstado || persona.estado === filtroEstado;
      return coincideBusqueda && coincideEstado;
    });
  }, [personas, busqueda, filtroEstado]);

  return (
    <AppShell>
      <div className="contenedor-pagina contenedor-pagina--ancho">
        <nav className="migas">
          <strong>Personas</strong>
        </nav>
        <div className="encabezado-pagina">
          <div>
            <h1>Directorio de personas</h1>
            <p className="subtitulo-pagina">
              Padrón vigente de la plantilla y su situación laboral actual.
            </p>
          </div>
          <a href="/personas/nueva" className="boton-con-icono boton-primario">
            <Plus size={16} aria-hidden="true" />
            Agregar persona
          </a>
        </div>

        <div className="banda-metricas">
          <div className="metrica">
            <span className="etiqueta-metrica">Total en padrón</span>
            <strong>{metricas.total}</strong>
            <span className="detalle-metrica">personas registradas</span>
          </div>
          <div className="metrica">
            <span className="etiqueta-metrica">
              <span className="punto punto--exito" aria-hidden="true" />
              Activos
            </span>
            <strong>{metricas.activos}</strong>
          </div>
          <div className="metrica">
            <span className="etiqueta-metrica">
              <span className="punto punto--aviso" aria-hidden="true" />
              Suspensión temporal
            </span>
            <strong>{metricas.suspension}</strong>
          </div>
          <div className="metrica">
            <span className="etiqueta-metrica">
              <span className="punto punto--peligro" aria-hidden="true" />
              Bajas del mes
            </span>
            <strong>{metricas.bajasDelMes}</strong>
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
          <select
            value={filtroEstado}
            onChange={(evento) => setFiltroEstado(evento.target.value)}
            aria-label="Filtrar por estado"
          >
            <option value="">Estado: Todos</option>
            <option value="activo">Activo</option>
            <option value="suspension">Suspensión</option>
            <option value="baja_definitiva">Baja</option>
          </select>
        </div>

        {estadoCarga === "cargando" && <p>Cargando personas…</p>}

        {estadoCarga === "error" && (
          <div className="tarjeta-error" role="alert">
            <strong>
              <AlertCircle size={16} aria-hidden="true" />
              No se pudo cargar el directorio
            </strong>
            <p>Ocurrió un problema al consultar el padrón.</p>
            <button type="button" onClick={cargar}>
              Reintentar
            </button>
          </div>
        )}

        {estadoCarga === "listo" && filtradas.length === 0 && (
          <p>No hay personas registradas o tu cuenta no tiene acceso al padrón.</p>
        )}

        {estadoCarga === "listo" && filtradas.length > 0 && (
          <>
            <div className="tabla-desplazable">
              <table>
                <thead>
                  <tr>
                    <th>Persona</th>
                    <th>Ingreso</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((persona) => (
                    <tr key={persona.id}>
                      <td>
                        <a href={`/personas/${persona.id}`} className="persona-celda">
                          <span className="avatar-iniciales">{inicialesDe(persona)}</span>
                          {persona.primer_nombre} {persona.apellido_paterno}
                        </a>
                      </td>
                      <td>{formatearFecha(persona.fecha_ingreso)}</td>
                      <td>
                        <span className={`insignia ${CLASE_ESTADO[persona.estado] ?? "insignia--neutra"}`}>
                          {ETIQUETA_ESTADO[persona.estado] ?? persona.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="pie-tabla">
              Mostrando {filtradas.length} de {personas.length} personas
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}

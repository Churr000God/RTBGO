import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Building2, Loader2, Plus, Search } from "lucide-react";

import { apiFetch } from "../lib/apiClient";
import { AppShell } from "../layouts/AppShell";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";

type Puesto = {
  id: string;
  departamento_id: string;
  nombre_puesto: string;
  nivel: string;
  plazas_totales: number;
  reporta_a_id: string | null;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
};

type Departamento = {
  id: string;
  nombre_departamento: string;
};

type EstadoCarga = "cargando" | "listo" | "error";

const ETIQUETA_NIVEL: Record<string, string> = {
  direccion: "Dirección",
  gerencia: "Gerencia",
  mando_medio: "Mando medio",
  operativo: "Operativo",
};

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase();
}

export function DirectorioPuestosPage() {
  const [puestos, setPuestos] = useState<Puesto[]>([]);
  const [nombresDepartamento, setNombresDepartamento] = useState<Record<string, string>>({});
  const [estadoCarga, setEstadoCarga] = useState<EstadoCarga>("cargando");
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  function cargar() {
    setEstadoCarga("cargando");
    Promise.all([
      apiFetch("/api/puestos").then((r) => {
        if (!r.ok) throw new Error(`status ${r.status}`);
        return r.json();
      }),
      apiFetch("/api/departamentos").then((r) => {
        if (!r.ok) throw new Error(`status ${r.status}`);
        return r.json();
      }),
    ])
      .then(([datosPuestos, datosDepartamentos]: [Puesto[], Departamento[]]) => {
        setPuestos(datosPuestos);
        setNombresDepartamento(
          Object.fromEntries(datosDepartamentos.map((d) => [d.id, d.nombre_departamento])),
        );
        setEstadoCarga("listo");
      })
      .catch(() => setEstadoCarga("error"));
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autorreferencial: el propio listado de /api/puestos ya tiene todo lo necesario para
  // resolver "reporta a" — no hace falta un fetch aparte.
  const nombresPuesto = useMemo(
    () => Object.fromEntries(puestos.map((p) => [p.id, p.nombre_puesto])),
    [puestos],
  );

  const metricas = useMemo(
    () => ({
      total: puestos.length,
      activos: puestos.filter((p) => p.activo).length,
      inactivos: puestos.filter((p) => !p.activo).length,
    }),
    [puestos],
  );

  const filtrados = useMemo(() => {
    const consulta = normalizar(busqueda.trim());
    return puestos.filter((puesto) => {
      const coincideBusqueda = !consulta || normalizar(puesto.nombre_puesto).includes(consulta);
      const coincideEstado =
        !filtroEstado || (filtroEstado === "activo" ? puesto.activo : !puesto.activo);
      return coincideBusqueda && coincideEstado;
    });
  }, [puestos, busqueda, filtroEstado]);

  return (
    <AppShell>
      <div className="contenedor-pagina contenedor-pagina--ancho">
        <nav className="migas">
          Estructura organizacional › <strong>Puestos</strong>
        </nav>
        <div className="encabezado-pagina">
          <div>
            <h1>Puestos</h1>
            <p className="subtitulo-pagina">Catálogo de puestos por departamento.</p>
          </div>
          <Button href="/estructura/puestos/nueva" variante="primario" icono={Plus} posicionIcono="izquierda">
            Nuevo puesto
          </Button>
        </div>

        <div className="banda-metricas">
          <div className="metrica">
            <span className="etiqueta-metrica">Total</span>
            <strong>{metricas.total}</strong>
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
              <span className="punto punto--peligro" aria-hidden="true" />
              Inactivos
            </span>
            <strong>{metricas.inactivos}</strong>
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
            <option value="inactivo">Inactivo</option>
          </select>
        </div>

        {estadoCarga === "cargando" && (
          <p className="boton-con-icono">
            <Loader2 size={16} className="icono-girando" aria-hidden="true" />
            Cargando puestos…
          </p>
        )}

        {estadoCarga === "error" && (
          <div className="tarjeta-error" role="alert">
            <strong>
              <AlertCircle size={16} aria-hidden="true" />
              No se pudo cargar el listado de puestos
            </strong>
            <p>Ocurrió un problema al consultar el catálogo.</p>
            <button type="button" onClick={cargar}>
              Reintentar
            </button>
          </div>
        )}

        {estadoCarga === "listo" && filtrados.length === 0 && (
          <div className="estado-vacio">
            <Building2 size={28} aria-hidden="true" />
            <p>No hay puestos registrados o tu cuenta no tiene acceso al catálogo.</p>
          </div>
        )}

        {estadoCarga === "listo" && filtrados.length > 0 && (
          <>
            <div className="tabla-desplazable">
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Departamento</th>
                    <th>Nivel</th>
                    <th>Reporta a</th>
                    <th>Plazas</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((puesto) => (
                    <tr key={puesto.id}>
                      <td>
                        <a href={`/estructura/puestos/${puesto.id}`} style={{ fontWeight: 600 }}>
                          {puesto.nombre_puesto}
                        </a>
                      </td>
                      <td>{nombresDepartamento[puesto.departamento_id] ?? "—"}</td>
                      <td>{ETIQUETA_NIVEL[puesto.nivel] ?? puesto.nivel}</td>
                      <td>{puesto.reporta_a_id ? nombresPuesto[puesto.reporta_a_id] ?? "—" : "—"}</td>
                      <td>{puesto.plazas_totales}</td>
                      <td>
                        <Badge variante={puesto.activo ? "exito" : "peligro"}>
                          {puesto.activo ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="pie-tabla">
              Mostrando {filtrados.length} de {puestos.length} puestos
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}

import { type FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertCircle, Loader2, Plus } from "lucide-react";

import { apiFetch } from "../lib/apiClient";
import { AppShell } from "../layouts/AppShell";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Input } from "../components/Input";

type PuestoPermiso = {
  id: string;
  puesto_id: string;
  codigo: string;
  activo: boolean;
};

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

type EstadoCarga = "cargando" | "listo" | "error";

const NIVELES = [
  { value: "direccion", label: "Dirección" },
  { value: "gerencia", label: "Gerencia" },
  { value: "mando_medio", label: "Mando medio" },
  { value: "operativo", label: "Operativo" },
];

function formatearFecha(fecha?: string | null): string {
  if (!fecha) return "—";
  const valor = new Date(fecha);
  if (Number.isNaN(valor.getTime())) return "—";
  return valor.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
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

export function FichaPuestoPage() {
  const { id } = useParams<{ id: string }>();
  const [puesto, setPuesto] = useState<Puesto | null>(null);
  const [nombreDepartamento, setNombreDepartamento] = useState<string | null>(null);
  const [nombreSuperior, setNombreSuperior] = useState<string | null>(null);
  const [permisos, setPermisos] = useState<PuestoPermiso[]>([]);
  const [estadoPermisos, setEstadoPermisos] = useState<EstadoCarga>("cargando");
  const [estadoCarga, setEstadoCarga] = useState<EstadoCarga>("cargando");
  const [error, setError] = useState<string | null>(null);

  function cargar() {
    setEstadoCarga("cargando");
    apiFetch(`/api/puestos/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`status ${r.status}`);
        return r.json();
      })
      .then((datosPuesto: Puesto) => {
        setPuesto(datosPuesto);
        setEstadoCarga("listo");

        apiFetch(`/api/departamentos/${datosPuesto.departamento_id}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((datos: { nombre_departamento: string } | null) =>
            setNombreDepartamento(datos?.nombre_departamento ?? null),
          )
          .catch(() => setNombreDepartamento(null));

        if (datosPuesto.reporta_a_id) {
          apiFetch(`/api/puestos/${datosPuesto.reporta_a_id}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((datos: { nombre_puesto: string } | null) =>
              setNombreSuperior(datos?.nombre_puesto ?? null),
            )
            .catch(() => setNombreSuperior(null));
        } else {
          setNombreSuperior(null);
        }

        // Estado de carga independiente del principal: si esto falla, la ficha degrada a "sin
        // permisos" en vez de romperse, mismo criterio que nombreDepartamento/nombreSuperior.
        // /vigentes es el estado actual (con activo real) -- /otorgados es la bitácora de
        // eventos, no sirve para saber qué tiene el puesto ahora mismo.
        setEstadoPermisos("cargando");
        apiFetch("/api/permisos/vigentes")
          .then((r) => {
            if (!r.ok) throw new Error(`status ${r.status}`);
            return r.json();
          })
          .then((datos: PuestoPermiso[]) => {
            setPermisos(datos.filter((p) => p.puesto_id === id && p.activo));
            setEstadoPermisos("listo");
          })
          .catch(() => setEstadoPermisos("error"));
      })
      .catch(() => setEstadoCarga("error"));
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleGuardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    const f = new FormData(evento.currentTarget);
    const respuesta = await apiFetch(`/api/puestos/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        nombre_puesto: f.get("nombre_puesto"),
        nivel: f.get("nivel"),
        plazas_totales: Number(f.get("plazas_totales")),
      }),
    });
    if (!respuesta.ok) {
      setError(await mensajeDeError(respuesta, "No se pudo guardar el cambio."));
      return;
    }
    setPuesto(await respuesta.json());
  }

  async function handleEstado(nuevoActivo: boolean) {
    setError(null);
    const respuesta = await apiFetch(`/api/puestos/${id}/estado`, {
      method: "PATCH",
      body: JSON.stringify({ activo: nuevoActivo }),
    });
    if (!respuesta.ok) {
      // A diferencia de área/departamento, acá el 422 SÍ es una regla real que puede
      // dispararse siempre (subordinados activos, o departamento/superior inactivo al
      // reactivar) — se muestra el detail que manda el backend, no un genérico inventado.
      setError(await mensajeDeError(respuesta, "No se pudo cambiar el estado del puesto."));
      return;
    }
    setPuesto(await respuesta.json());
  }

  if (estadoCarga === "cargando") {
    return (
      <AppShell>
        <p className="contenedor-pagina" style={{ marginTop: "2.5rem" }}>
          <span className="boton-con-icono">
            <Loader2 size={16} className="icono-girando" aria-hidden="true" />
            Cargando…
          </span>
        </p>
      </AppShell>
    );
  }

  if (estadoCarga === "error" || !puesto) {
    return (
      <AppShell>
        <div className="contenedor-pagina" style={{ marginTop: "2.5rem" }}>
          <div className="tarjeta-error" role="alert">
            <strong>
              <AlertCircle size={16} aria-hidden="true" />
              No se pudo cargar este puesto
            </strong>
            <p>Ocurrió un problema al consultar el catálogo.</p>
            <button type="button" onClick={cargar}>
              Reintentar
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="contenedor-pagina">
        <nav className="migas">
          <a href="/estructura/puestos">Puestos</a> / <strong>{puesto.nombre_puesto}</strong>
        </nav>

        <div className="cabecera-persona cabecera-ficha">
          <div className="identidad">
            <div className="fila-nombre-badge">
              <strong>{puesto.nombre_puesto}</strong>
              <Badge estado={puesto.activo ? "activo" : "baja_definitiva"}>
                {puesto.activo ? "Activo" : "Inactivo"}
              </Badge>
            </div>
          </div>
          <div className="botonera">
            {puesto.activo ? (
              <Button type="button" onClick={() => handleEstado(false)}>
                Desactivar puesto
              </Button>
            ) : (
              <Button type="button" onClick={() => handleEstado(true)} variante="primario">
                Reactivar puesto
              </Button>
            )}
          </div>
        </div>

        {error && <p role="alert">{error}</p>}

        <Card>
          <h3>Ubicación en la estructura</h3>
          <div className="rejilla-datos">
            <div className="dato">
              <span>Departamento</span>
              <strong>{nombreDepartamento ?? "—"}</strong>
            </div>
            <div className="dato">
              <span>Reporta a</span>
              <strong>{puesto.reporta_a_id ? nombreSuperior ?? "—" : "— (puesto tope)"}</strong>
            </div>
          </div>
        </Card>

        <Card as="form" onSubmit={handleGuardar}>
          <h3>Datos del puesto</h3>
          <Input
            id="nombre_puesto"
            name="nombre_puesto"
            label="Nombre"
            required
            maxLength={100}
            defaultValue={puesto.nombre_puesto}
          />
          <div className="campo">
            <label htmlFor="nivel">Nivel</label>
            <select id="nivel" name="nivel" required defaultValue={puesto.nivel}>
              {NIVELES.map((nivel) => (
                <option key={nivel.value} value={nivel.value}>
                  {nivel.label}
                </option>
              ))}
            </select>
          </div>
          <Input
            id="plazas_totales"
            name="plazas_totales"
            label="Plazas totales"
            type="number"
            min={1}
            required
            defaultValue={puesto.plazas_totales}
          />
          <div className="botonera">
            <button type="submit">Guardar</button>
          </div>
        </Card>

        <Card>
          <div className="fila-cabecera-tarjeta">
            <h3>Permisos de este puesto</h3>
            <Button
              href={`/estructura/permisos/otorgar?puesto_id=${puesto.id}`}
              className="enlace-etiqueta"
              icono={Plus}
              posicionIcono="izquierda"
              tamanoIcono={14}
            >
              Otorgar permiso
            </Button>
          </div>
          {estadoPermisos === "cargando" && (
            <p className="boton-con-icono">
              <Loader2 size={14} className="icono-girando" aria-hidden="true" />
              Cargando permisos…
            </p>
          )}
          {estadoPermisos === "error" && <p>No se pudieron cargar los permisos de este puesto.</p>}
          {estadoPermisos === "listo" && permisos.length === 0 && (
            <p>Este puesto no tiene permisos otorgados actualmente.</p>
          )}
          {estadoPermisos === "listo" && permisos.length > 0 && (
            <ul className="lista-historial-resumido">
              {permisos.map((permiso) => (
                <li key={permiso.id}>
                  <span style={{ fontWeight: 600 }}>{permiso.codigo}</span>
                  <a href={`/estructura/permisos/${permiso.id}/revocar`}>Revocar</a>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3>Fechas</h3>
          <div className="rejilla-datos">
            <div className="dato">
              <span>Creado el</span>
              <strong>{formatearFecha(puesto.creado_en)}</strong>
            </div>
            <div className="dato">
              <span>Última actualización</span>
              <strong>{formatearFecha(puesto.actualizado_en)}</strong>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

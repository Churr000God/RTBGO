import { type FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertCircle, Loader2 } from "lucide-react";

import { apiFetch } from "../lib/apiClient";
import { AppShell } from "../layouts/AppShell";

type Departamento = {
  id: string;
  area_id: string;
  nombre_departamento: string;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
};

type Area = {
  id: string;
  nombre_area: string;
};

type EstadoCarga = "cargando" | "listo" | "error";

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

export function FichaDepartamentoPage() {
  const { id } = useParams<{ id: string }>();
  const [departamento, setDepartamento] = useState<Departamento | null>(null);
  const [nombreArea, setNombreArea] = useState<string | null>(null);
  const [estadoCarga, setEstadoCarga] = useState<EstadoCarga>("cargando");
  const [error, setError] = useState<string | null>(null);

  function cargar() {
    setEstadoCarga("cargando");
    apiFetch(`/api/departamentos/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`status ${r.status}`);
        return r.json();
      })
      .then((datosDepartamento: Departamento) => {
        setDepartamento(datosDepartamento);
        setEstadoCarga("listo");
        return apiFetch(`/api/areas/${datosDepartamento.area_id}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((datosArea: Area | null) => setNombreArea(datosArea?.nombre_area ?? null))
          .catch(() => setNombreArea(null));
      })
      .catch(() => setEstadoCarga("error"));
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleRenombrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    const f = new FormData(evento.currentTarget);
    const respuesta = await apiFetch(`/api/departamentos/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ nombre_departamento: f.get("nombre_departamento") }),
    });
    if (!respuesta.ok) {
      if (respuesta.status === 409) {
        setError("Ya existe un departamento con ese nombre.");
      } else {
        setError(await mensajeDeError(respuesta, "No se pudo guardar el cambio."));
      }
      return;
    }
    setDepartamento(await respuesta.json());
  }

  async function handleEstado(nuevoActivo: boolean) {
    setError(null);
    const respuesta = await apiFetch(`/api/departamentos/${id}/estado`, {
      method: "PATCH",
      body: JSON.stringify({ activo: nuevoActivo }),
    });
    if (!respuesta.ok) {
      if (respuesta.status === 400 || respuesta.status === 422) {
        setError(
          "No se pudo cambiar el estado: revisa que el área esté activa y que no tenga puestos activos debajo.",
        );
      } else {
        setError(await mensajeDeError(respuesta, "No se pudo cambiar el estado del departamento."));
      }
      return;
    }
    setDepartamento(await respuesta.json());
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

  if (estadoCarga === "error" || !departamento) {
    return (
      <AppShell>
        <div className="contenedor-pagina" style={{ marginTop: "2.5rem" }}>
          <div className="tarjeta-error" role="alert">
            <strong>
              <AlertCircle size={16} aria-hidden="true" />
              No se pudo cargar este departamento
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
          <a href="/estructura/departamentos">Departamentos</a> /{" "}
          <strong>{departamento.nombre_departamento}</strong>
        </nav>

        <div className="cabecera-persona cabecera-ficha">
          <div className="identidad">
            <div className="fila-nombre-badge">
              <strong>{departamento.nombre_departamento}</strong>
              <span className={`insignia-estado ${departamento.activo ? "activo" : "baja_definitiva"}`}>
                {departamento.activo ? "Activo" : "Inactivo"}
              </span>
            </div>
          </div>
          <div className="botonera">
            {departamento.activo ? (
              <button type="button" onClick={() => handleEstado(false)} className="boton-con-icono">
                Desactivar departamento
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleEstado(true)}
                className="boton-con-icono boton-primario"
              >
                Reactivar departamento
              </button>
            )}
          </div>
        </div>

        {error && <p role="alert">{error}</p>}

        <div className="tarjeta-resumen">
          <h3>Área</h3>
          <div className="dato">
            <span>Área a la que pertenece</span>
            <strong>{nombreArea ?? "—"}</strong>
          </div>
        </div>

        <form onSubmit={handleRenombrar} className="tarjeta-resumen">
          <h3>Nombre del departamento</h3>
          <div className="campo">
            <label htmlFor="nombre_departamento">Nombre</label>
            <input
              id="nombre_departamento"
              name="nombre_departamento"
              required
              maxLength={100}
              defaultValue={departamento.nombre_departamento}
            />
          </div>
          <div className="botonera">
            <button type="submit">Guardar</button>
          </div>
        </form>

        <div className="tarjeta-resumen">
          <h3>Fechas</h3>
          <div className="rejilla-datos">
            <div className="dato">
              <span>Creado el</span>
              <strong>{formatearFecha(departamento.creado_en)}</strong>
            </div>
            <div className="dato">
              <span>Última actualización</span>
              <strong>{formatearFecha(departamento.actualizado_en)}</strong>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

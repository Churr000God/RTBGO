import { type FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertCircle, Loader2 } from "lucide-react";

import { apiFetch } from "../lib/apiClient";
import { AppShell } from "../layouts/AppShell";

type Area = {
  id: string;
  nombre_area: string;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
};

type EstadoCarga = "cargando" | "listo" | "error";

function formatearFecha(fecha?: string | null): string {
  if (!fecha) return "—";
  const valor = new Date(fecha);
  if (Number.isNaN(valor.getTime())) return "—";
  return valor.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export function FichaAreaPage() {
  const { id } = useParams<{ id: string }>();
  const [area, setArea] = useState<Area | null>(null);
  const [estadoCarga, setEstadoCarga] = useState<EstadoCarga>("cargando");
  const [error, setError] = useState<string | null>(null);

  function cargar() {
    setEstadoCarga("cargando");
    apiFetch(`/api/areas/${id}`)
      .then((respuesta) => {
        if (!respuesta.ok) throw new Error(`status ${respuesta.status}`);
        return respuesta.json();
      })
      .then((datos: Area) => {
        setArea(datos);
        setEstadoCarga("listo");
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
    const respuesta = await apiFetch(`/api/areas/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ nombre_area: f.get("nombre_area") }),
    });
    if (!respuesta.ok) {
      setError(
        respuesta.status === 409
          ? "Ya existe un área con ese nombre."
          : "No se pudo guardar el cambio.",
      );
      return;
    }
    setArea(await respuesta.json());
  }

  async function handleEstado(nuevoActivo: boolean) {
    setError(null);
    const respuesta = await apiFetch(`/api/areas/${id}/estado`, {
      method: "PATCH",
      body: JSON.stringify({ activo: nuevoActivo }),
    });
    if (!respuesta.ok) {
      setError("No se pudo cambiar el estado del área.");
      return;
    }
    setArea(await respuesta.json());
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

  if (estadoCarga === "error" || !area) {
    return (
      <AppShell>
        <div className="contenedor-pagina" style={{ marginTop: "2.5rem" }}>
          <div className="tarjeta-error" role="alert">
            <strong>
              <AlertCircle size={16} aria-hidden="true" />
              No se pudo cargar esta área
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
          <a href="/estructura/areas">Áreas</a> / <strong>{area.nombre_area}</strong>
        </nav>

        <div className="cabecera-persona cabecera-ficha">
          <div className="identidad">
            <div className="fila-nombre-badge">
              <strong>{area.nombre_area}</strong>
              <span className={`insignia-estado ${area.activo ? "activo" : "baja_definitiva"}`}>
                {area.activo ? "Activo" : "Inactivo"}
              </span>
            </div>
          </div>
          <div className="botonera">
            {area.activo ? (
              <button type="button" onClick={() => handleEstado(false)} className="boton-con-icono">
                Desactivar área
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleEstado(true)}
                className="boton-con-icono boton-primario"
              >
                Reactivar área
              </button>
            )}
          </div>
        </div>

        {error && <p role="alert">{error}</p>}

        <form onSubmit={handleRenombrar} className="tarjeta-resumen">
          <h3>Nombre del área</h3>
          <div className="campo">
            <label htmlFor="nombre_area">Nombre</label>
            <input id="nombre_area" name="nombre_area" required maxLength={100} defaultValue={area.nombre_area} />
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
              <strong>{formatearFecha(area.creado_en)}</strong>
            </div>
            <div className="dato">
              <span>Última actualización</span>
              <strong>{formatearFecha(area.actualizado_en)}</strong>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

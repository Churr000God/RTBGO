import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Wrench } from "lucide-react";

import { apiFetch } from "../lib/apiClient";
import { AppShell } from "../layouts/AppShell";

type Excepcion = {
  id: number;
  motivo_revision: string;
  estado: "pendiente" | "resuelto";
  creado_en: string;
  marca_id: number | null;
  dia_id: number | null;
  persona_nombre: string | null;
  momento_dispositivo: string | null;
};

type EstadoCarga = "cargando" | "listo" | "error";

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

export function ColaExcepcionesPage() {
  const [excepciones, setExcepciones] = useState<Excepcion[]>([]);
  const [estadoCarga, setEstadoCarga] = useState<EstadoCarga>("cargando");

  function cargar() {
    setEstadoCarga("cargando");
    apiFetch("/api/excepciones")
      .then((respuesta) => {
        if (!respuesta.ok) throw new Error(`status ${respuesta.status}`);
        return respuesta.json();
      })
      .then((datos: Excepcion[]) => {
        // El servidor ya filtra a estado='pendiente'. marca_id != null: excepciones de un día
        // sin checada (dia_id) las resuelve la bandeja de ausencias (SCJ-PRO-08) al
        // aprobar/rechazar — se cierran solas por trigger, no tienen corrección propia acá.
        setExcepciones(datos.filter((e) => e.marca_id !== null));
        setEstadoCarga("listo");
      })
      .catch(() => setEstadoCarga("error"));
  }

  useEffect(() => {
    cargar();
  }, []);

  return (
    <AppShell>
      <div className="contenedor-pagina contenedor-pagina--ancho">
        <nav className="migas">
          <strong>Excepciones pendientes</strong>
        </nav>
        <div className="encabezado-pagina">
          <div>
            <h1>Excepciones pendientes</h1>
            <p className="subtitulo-pagina">
              Marcas apartadas para revisión — corrígelas para cerrar la excepción.
            </p>
          </div>
        </div>

        {estadoCarga === "cargando" && (
          <p className="boton-con-icono">
            <Loader2 size={16} className="icono-girando" aria-hidden="true" />
            Cargando excepciones…
          </p>
        )}

        {estadoCarga === "error" && (
          <div className="tarjeta-error" role="alert">
            <strong>
              <AlertCircle size={16} aria-hidden="true" />
              No se pudo cargar la cola de excepciones
            </strong>
            <p>Ocurrió un problema al consultar las excepciones pendientes.</p>
            <button type="button" onClick={cargar}>
              Reintentar
            </button>
          </div>
        )}

        {estadoCarga === "listo" && excepciones.length === 0 && (
          <div className="estado-vacio">
            <p>No hay excepciones de marca pendientes.</p>
          </div>
        )}

        {estadoCarga === "listo" && excepciones.length > 0 && (
          <div className="tabla-desplazable">
            <table>
              <thead>
                <tr>
                  <th>Persona</th>
                  <th>Marca original</th>
                  <th>Motivo</th>
                  <th>Detectada</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {excepciones.map((excepcion) => (
                  <tr key={excepcion.id}>
                    <td>{excepcion.persona_nombre ?? "—"}</td>
                    <td>{formatearFechaHora(excepcion.momento_dispositivo)}</td>
                    <td>{excepcion.motivo_revision}</td>
                    <td>{formatearFechaHora(excepcion.creado_en)}</td>
                    <td>
                      <a
                        href={`/tiempo/excepciones/${excepcion.id}/corregir`}
                        className="boton-con-icono"
                      >
                        <Wrench size={14} aria-hidden="true" />
                        Corregir
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}

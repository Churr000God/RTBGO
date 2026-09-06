import { useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, X } from "lucide-react";

import { apiFetch } from "../lib/apiClient";
import { AppShell } from "../layouts/AppShell";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card } from "../components/Card";

type TipoAusenciaReclasificable =
  | "vacaciones"
  | "permiso_con_goce"
  | "permiso_sin_goce"
  | "incapacidad";

type Ausencia = {
  id: number;
  persona_id: string;
  persona_nombre: string | null;
  tipo_de_ausencia: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado_autorizacion: "pendiente" | "autorizada" | "rechazada";
};

type EstadoCarga = "cargando" | "listo" | "error";

const OPCIONES_RECLASIFICACION: { valor: TipoAusenciaReclasificable; etiqueta: string }[] = [
  { valor: "vacaciones", etiqueta: "Vacaciones" },
  { valor: "permiso_con_goce", etiqueta: "Permiso con goce" },
  { valor: "permiso_sin_goce", etiqueta: "Permiso sin goce" },
  { valor: "incapacidad", etiqueta: "Incapacidad" },
];

function formatearFecha(fecha: string): string {
  // fecha_inicio/fecha_fin son DATE (sin hora) — new Date("2026-09-10") a secas lo interpreta
  // como medianoche UTC, y en cualquier timezone detrás de UTC (ej. America/Mexico_City)
  // muestra el día anterior. Forzar hora local evita el corrimiento.
  const valor = new Date(`${fecha}T00:00:00`);
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

type PropsFila = {
  ausencia: Ausencia;
  onResuelta: () => void;
};

function FilaAusencia({ ausencia, onResuelta }: PropsFila) {
  const [tipoElegido, setTipoElegido] = useState<TipoAusenciaReclasificable | "">("");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState<"autorizada" | "rechazada" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolver(decision: "autorizada" | "rechazada") {
    setError(null);
    setEnviando(decision);
    try {
      const respuesta = await apiFetch(`/api/ausencias/${ausencia.id}/resolver`, {
        method: "POST",
        body: JSON.stringify({
          decision,
          // Rechazar deja tipo_de_ausencia='falta' — el backend no espera reclasificación.
          tipo_de_ausencia: decision === "autorizada" ? tipoElegido : undefined,
          motivo: motivo || undefined,
        }),
      });
      if (!respuesta.ok) {
        setError(await mensajeDeError(respuesta, "No se pudo resolver la ausencia."));
        return;
      }
      onResuelta();
    } catch {
      setError("No se pudo resolver la ausencia. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setEnviando(null);
    }
  }

  return (
    <Card>
      <div className="cabecera-persona">
        <div className="identidad">
          <div>
            <strong>{ausencia.persona_nombre ?? "—"}</strong>
            <p className="meta-ficha">
              {formatearFecha(ausencia.fecha_inicio)} – {formatearFecha(ausencia.fecha_fin)}
            </p>
          </div>
        </div>
        <Badge variante="aviso">Falta sin resolver</Badge>
      </div>

      <div className="campo">
        <label htmlFor={`tipo-${ausencia.id}`}>Reclasificar a (sólo si apruebas)</label>
        <select
          id={`tipo-${ausencia.id}`}
          value={tipoElegido}
          onChange={(evento) => setTipoElegido(evento.target.value as TipoAusenciaReclasificable | "")}
        >
          <option value="">Selecciona un tipo para aprobar</option>
          {OPCIONES_RECLASIFICACION.map(({ valor, etiqueta }) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
      </div>

      <div className="campo">
        <label htmlFor={`motivo-${ausencia.id}`}>Motivo (opcional)</label>
        <textarea
          id={`motivo-${ausencia.id}`}
          value={motivo}
          onChange={(evento) => setMotivo(evento.target.value)}
          rows={2}
        />
      </div>

      {error && <p role="alert">{error}</p>}
      <div className="botonera">
        <Button
          type="button"
          onClick={() => resolver("rechazada")}
          icono={X}
          posicionIcono="izquierda"
          cargando={enviando === "rechazada"}
          textoCargando="Rechazando…"
          disabled={enviando !== null}
        >
          Rechazar (queda como falta)
        </Button>
        <Button
          type="button"
          variante="primario"
          icono={Check}
          posicionIcono="izquierda"
          cargando={enviando === "autorizada"}
          textoCargando="Aprobando…"
          disabled={enviando !== null || !tipoElegido}
          onClick={() => resolver("autorizada")}
        >
          Aprobar
        </Button>
      </div>
    </Card>
  );
}

export function BandejaAusenciasPage() {
  const [ausencias, setAusencias] = useState<Ausencia[]>([]);
  const [estadoCarga, setEstadoCarga] = useState<EstadoCarga>("cargando");

  function cargar() {
    setEstadoCarga("cargando");
    apiFetch("/api/ausencias/pendientes")
      .then((respuesta) => {
        if (!respuesta.ok) throw new Error(`status ${respuesta.status}`);
        return respuesta.json();
      })
      .then((datos: Ausencia[]) => {
        // Ya viene filtrado del servidor (tiempo.ausencia es historial que crece, filtran
        // server-side a propósito) — no hace falta repetir el filtro en cliente.
        setAusencias(datos);
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
          <strong>Ausencias pendientes</strong>
        </nav>
        <div className="encabezado-pagina">
          <div>
            <h1>Ausencias pendientes</h1>
            <p className="subtitulo-pagina">
              Días sin marca detectados por el sistema — reclasifica o rechaza cada uno.
            </p>
          </div>
        </div>

        {estadoCarga === "cargando" && (
          <p className="boton-con-icono">
            <Loader2 size={16} className="icono-girando" aria-hidden="true" />
            Cargando ausencias…
          </p>
        )}

        {estadoCarga === "error" && (
          <div className="tarjeta-error" role="alert">
            <strong>
              <AlertCircle size={16} aria-hidden="true" />
              No se pudo cargar la bandeja de ausencias
            </strong>
            <p>Ocurrió un problema al consultar las ausencias pendientes.</p>
            <button type="button" onClick={cargar}>
              Reintentar
            </button>
          </div>
        )}

        {estadoCarga === "listo" && ausencias.length === 0 && (
          <div className="estado-vacio">
            <p>No hay ausencias pendientes de resolver.</p>
          </div>
        )}

        {estadoCarga === "listo" && ausencias.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {ausencias.map((ausencia) => (
              <FilaAusencia key={ausencia.id} ausencia={ausencia} onResuelta={cargar} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

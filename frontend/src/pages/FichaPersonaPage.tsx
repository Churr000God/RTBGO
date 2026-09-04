import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";

import { apiFetch } from "../lib/apiClient";
import { AppShell } from "../layouts/AppShell";
import { derivarTransiciones, type Estado, type Movimiento } from "../lib/movimientos";

type Persona = {
  id: string;
  primer_nombre: string;
  segundo_nombre: string | null;
  apellido_paterno: string;
  apellido_materno: string | null;
  curp: string;
  rfc: string;
  nss: string;
  fecha_nacimiento: string;
  fecha_ingreso: string;
  estado: string;
  tipo_contrato: string;
  documento_ref: string;
};

const ETIQUETA_ESTADO: Record<Estado, string> = {
  activo: "Activo",
  suspension: "Suspendido",
  baja_definitiva: "Baja",
};

const CLASE_ESTADO: Record<Estado, string> = {
  activo: "insignia--exito",
  suspension: "insignia--aviso",
  baja_definitiva: "insignia--peligro",
};

const ETIQUETA_TIPO_CONTRATO: Record<string, string> = {
  indefinido: "Indefinido",
  prestacion_servicios: "Prestación de servicios",
  por_proyecto: "Por proyecto",
};

function formatearFecha(fecha?: string | null): string {
  if (!fecha) return "—";
  // fecha_nacimiento/fecha_ingreso llegan como "AAAA-MM-DD" (sin hora) — agregar T00:00:00
  // evita que se interprete en UTC y se corra un día en zonas horarias negativas. Los
  // movimientos ya traen datetime completo (fecha_efectiva), no hay que tocarlos.
  const valor = fecha.includes("T") ? new Date(fecha) : new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(valor.getTime())) return "—";
  return valor.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export function FichaPersonaPage() {
  const { id } = useParams<{ id: string }>();
  const [persona, setPersona] = useState<Persona | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);

  useEffect(() => {
    apiFetch(`/api/personas/${id}`)
      .then((r) => r.json())
      .then(setPersona);
    apiFetch(`/api/personas/${id}/movimientos`)
      .then((r) => r.json())
      .then(setMovimientos);
  }, [id]);

  if (!persona) {
    return (
      <AppShell>
        <p className="contenedor-pagina" style={{ marginTop: "2.5rem" }}>
          Cargando…
        </p>
      </AppShell>
    );
  }

  const nombreCompleto = [
    persona.primer_nombre,
    persona.segundo_nombre,
    persona.apellido_paterno,
    persona.apellido_materno,
  ]
    .filter(Boolean)
    .join(" ");
  const iniciales = `${persona.primer_nombre[0] ?? ""}${persona.apellido_paterno[0] ?? ""}`.toUpperCase();
  const idCorto = persona.id.slice(0, 8);
  const estado = persona.estado as Estado;

  const ultimosMovimientos = [...derivarTransiciones(movimientos)].reverse().slice(0, 3);

  return (
    <AppShell>
      <div className="contenedor-pagina contenedor-pagina--ancho">
        <nav className="migas">
          <a href="/personas">Personas</a> / <strong>{nombreCompleto}</strong>
        </nav>

        <div className="cabecera-persona cabecera-ficha">
          <div className="identidad">
            <span className="avatar-iniciales">{iniciales}</span>
            <div>
              <div className="fila-nombre-badge">
                <strong>{nombreCompleto}</strong>
                <span className={`insignia ${CLASE_ESTADO[estado] ?? "insignia--neutra"}`}>
                  {ETIQUETA_ESTADO[estado] ?? persona.estado}
                </span>
              </div>
              <p className="meta-ficha">
                ID {idCorto} · Ingreso {formatearFecha(persona.fecha_ingreso)}
              </p>
            </div>
          </div>
          <a href={`/personas/${persona.id}/movimiento`} className="boton-con-icono boton-primario">
            <RefreshCw size={16} aria-hidden="true" />
            Nuevo movimiento
          </a>
        </div>

        <div className="tarjeta-resumen">
          <h3>Datos personales</h3>
          <div className="rejilla-datos">
            <div className="dato">
              <span>Nombre completo</span>
              <strong>{nombreCompleto}</strong>
            </div>
            <div className="dato">
              <span>CURP</span>
              <strong>{persona.curp}</strong>
            </div>
            <div className="dato">
              <span>RFC</span>
              <strong>{persona.rfc}</strong>
            </div>
            <div className="dato">
              <span>NSS</span>
              <strong>{persona.nss}</strong>
            </div>
            <div className="dato">
              <span>Fecha de nacimiento</span>
              <strong>{formatearFecha(persona.fecha_nacimiento)}</strong>
            </div>
          </div>
        </div>

        <div className="tarjeta-resumen">
          <h3>Expediente</h3>
          <div className="dato">
            <span>Referencia de documento (documento_ref)</span>
            <p>
              <span className="pildora-monoespaciada">{persona.documento_ref}</span>
            </p>
            <small className="ayuda-campo">
              Formato RTB-__-__ · referencia única del expediente físico. Sólo se almacena esta
              referencia — no existe catálogo de documentos individuales por persona.
            </small>
          </div>
          <div className="rejilla-datos" style={{ marginTop: "1rem" }}>
            <div className="dato">
              <span>Tipo de contrato</span>
              <strong>{ETIQUETA_TIPO_CONTRATO[persona.tipo_contrato] ?? persona.tipo_contrato}</strong>
            </div>
          </div>
        </div>

        <div className="tarjeta-resumen">
          <div className="fila-cabecera-tarjeta">
            <h3>Historial de estado</h3>
            <a href={`/personas/${persona.id}/bitacora`} className="enlace-etiqueta">
              Ver bitácora completa →
            </a>
          </div>
          {ultimosMovimientos.length === 0 ? (
            <p>Sin movimientos registrados todavía.</p>
          ) : (
            <ul className="lista-historial-resumido">
              {ultimosMovimientos.map((movimiento) => (
                <li key={movimiento.id}>
                  <span className={`insignia ${CLASE_ESTADO[movimiento.estadoNuevo]}`}>
                    {ETIQUETA_ESTADO[movimiento.estadoNuevo]}
                  </span>
                  <span className="fecha-historial">{formatearFecha(movimiento.fecha_efectiva)}</span>
                  <span className="autor-historial">{movimiento.registrado_por_nombre ?? "Sistema"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}

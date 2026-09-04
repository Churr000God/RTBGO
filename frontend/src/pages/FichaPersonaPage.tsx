import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertCircle, KeyRound, Loader2, Plus, RefreshCw, Repeat } from "lucide-react";

import { apiFetch } from "../lib/apiClient";
import { AppShell } from "../layouts/AppShell";
import { derivarTransiciones, type Estado, type Movimiento } from "../lib/movimientos";

type PuestoVigente = {
  asignacion_id: string;
  puesto_id: string;
  nombre_puesto: string;
  nombre_departamento: string;
  nombre_area: string;
};

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
  tipo_contrato: string | null;
  documento_ref: string | null;
  tiene_usuario: boolean;
  puestos_vigentes: PuestoVigente[];
};

type Asignacion = {
  id: string;
  persona_id: string;
  nombre_puesto: string;
  vigente_desde: string;
  vigente_hasta: string | null;
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

type EstadoCarga = "cargando" | "listo" | "error";

export function FichaPersonaPage() {
  const { id } = useParams<{ id: string }>();
  const [persona, setPersona] = useState<Persona | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [estadoCarga, setEstadoCarga] = useState<EstadoCarga>("cargando");

  function cargar() {
    setEstadoCarga("cargando");
    Promise.all([
      apiFetch(`/api/personas/${id}`).then((r) => {
        if (!r.ok) throw new Error(`status ${r.status}`);
        return r.json();
      }),
      apiFetch(`/api/personas/${id}/movimientos`).then((r) => {
        if (!r.ok) throw new Error(`status ${r.status}`);
        return r.json();
      }),
      apiFetch("/api/asignaciones").then((r) => {
        if (!r.ok) throw new Error(`status ${r.status}`);
        return r.json();
      }),
    ])
      .then(([datosPersona, datosMovimientos, datosAsignaciones]: [Persona, Movimiento[], Asignacion[]]) => {
        setPersona(datosPersona);
        setMovimientos(datosMovimientos);
        setAsignaciones(datosAsignaciones.filter((a) => a.persona_id === id));
        setEstadoCarga("listo");
      })
      .catch(() => setEstadoCarga("error"));
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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

  if (estadoCarga === "error" || !persona) {
    return (
      <AppShell>
        <div className="contenedor-pagina" style={{ marginTop: "2.5rem" }}>
          <div className="tarjeta-error" role="alert">
            <strong>
              <AlertCircle size={16} aria-hidden="true" />
              No se pudo cargar la ficha de esta persona
            </strong>
            <p>Ocurrió un problema al consultar el padrón.</p>
            <button type="button" onClick={cargar}>
              Reintentar
            </button>
          </div>
        </div>
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
  const ultimosPuestos = [...asignaciones]
    .sort((a, b) => new Date(b.vigente_desde).getTime() - new Date(a.vigente_desde).getTime())
    .slice(0, 3);

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
          <div className="botonera">
            {!persona.tiene_usuario && (
              <a href={`/usuarios/nuevo?persona_id=${persona.id}`} className="boton-con-icono">
                <KeyRound size={16} aria-hidden="true" />
                Crear acceso a Kairos
              </a>
            )}
            <a href={`/personas/${persona.id}/movimiento`} className="boton-con-icono boton-primario">
              <RefreshCw size={16} aria-hidden="true" />
              Nuevo movimiento
            </a>
          </div>
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
              <strong className="campo-identificador">{persona.curp}</strong>
            </div>
            <div className="dato">
              <span>RFC</span>
              <strong className="campo-identificador">{persona.rfc}</strong>
            </div>
            <div className="dato">
              <span>NSS</span>
              <strong className="campo-identificador">{persona.nss}</strong>
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
            {persona.documento_ref ? (
              <p>
                <span className="pildora-monoespaciada">{persona.documento_ref}</span>
              </p>
            ) : (
              <p>Sin expediente asignado.</p>
            )}
            <small className="ayuda-campo">
              Formato RTB-__-__ · referencia única del expediente físico. Sólo se almacena esta
              referencia — no existe catálogo de documentos individuales por persona.
            </small>
          </div>
          <div className="rejilla-datos" style={{ marginTop: "1rem" }}>
            <div className="dato">
              <span>Tipo de contrato</span>
              <strong>
                {persona.tipo_contrato ? ETIQUETA_TIPO_CONTRATO[persona.tipo_contrato] ?? persona.tipo_contrato : "—"}
              </strong>
            </div>
          </div>
        </div>

        <div className="tarjeta-resumen">
          <div className="fila-cabecera-tarjeta">
            <h3>Asignación actual</h3>
            <a
              href={`/estructura/asignaciones/nueva?persona_id=${persona.id}`}
              className="boton-con-icono enlace-etiqueta"
            >
              <Plus size={14} aria-hidden="true" />
              Nueva asignación
            </a>
          </div>
          {persona.puestos_vigentes.length === 0 ? (
            <p>Sin puesto asignado actualmente.</p>
          ) : (
            <ul className="lista-historial-resumido">
              {persona.puestos_vigentes.map((puestoVigente) => (
                <li key={puestoVigente.asignacion_id}>
                  <span style={{ fontWeight: 600 }}>{puestoVigente.nombre_puesto}</span>
                  <span className="fecha-historial">
                    {puestoVigente.nombre_departamento} · {puestoVigente.nombre_area}
                  </span>
                  <div className="botonera" style={{ justifyContent: "flex-start" }}>
                    <a href={`/estructura/asignaciones/${puestoVigente.asignacion_id}/terminar`}>Terminar</a>
                    <a
                      href={`/estructura/asignaciones/${puestoVigente.asignacion_id}/cambiar-puesto`}
                      className="boton-con-icono boton-primario"
                    >
                      <Repeat size={14} aria-hidden="true" />
                      Cambiar de puesto
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="tarjeta-resumen">
          <div className="fila-cabecera-tarjeta">
            <h3>Historial de puestos</h3>
            <a href={`/personas/${persona.id}/bitacora-asignaciones`} className="enlace-etiqueta">
              Ver bitácora completa →
            </a>
          </div>
          {ultimosPuestos.length === 0 ? (
            <p>Sin asignaciones registradas todavía.</p>
          ) : (
            <ul className="lista-historial-resumido">
              {ultimosPuestos.map((asignacion) => (
                <li key={asignacion.id}>
                  <span className={`insignia ${asignacion.vigente_hasta ? "insignia--neutra" : "insignia--exito"}`}>
                    {asignacion.vigente_hasta ? "Terminada" : "Vigente"}
                  </span>
                  <span>{asignacion.nombre_puesto}</span>
                  <span className="fecha-historial">
                    {formatearFecha(asignacion.vigente_desde)}
                    {" — "}
                    {asignacion.vigente_hasta ? formatearFecha(asignacion.vigente_hasta) : "hoy"}
                  </span>
                </li>
              ))}
            </ul>
          )}
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

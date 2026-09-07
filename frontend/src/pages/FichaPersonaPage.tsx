import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  CalendarClock,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Repeat,
} from "lucide-react";

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
  tiene_jornada_vigente: boolean;
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

type Motivo = "sin_marcas" | "fuera_de_tolerancia";

type AlertaRetardo = {
  fecha: string;
  hora_entrada_programada: string;
  hora_salida_programada: string;
  motivo: Motivo;
};

const ETIQUETA_MOTIVO_ALERTA: Record<Motivo, string> = {
  sin_marcas: "Sin marcas ese día",
  fuera_de_tolerancia: "Fuera de tolerancia",
};

// Ventana del resumen en la ficha — 30 días alcanza para una vista rápida sin salir del
// tope de 62 días que impone el backend; el historial completo vive en la pantalla de
// Reportes › Alertas de retardo (enlace "Ver todas").
const DIAS_VENTANA_RESUMEN_ALERTAS = 29;

function aFechaISO(fecha: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`;
}

type DiaSemana =
  | "lunes"
  | "martes"
  | "miercoles"
  | "jueves"
  | "viernes"
  | "sabado"
  | "domingo";

const DIAS_SEMANA: { valor: DiaSemana; etiqueta: string }[] = [
  { valor: "lunes", etiqueta: "Lun" },
  { valor: "martes", etiqueta: "Mar" },
  { valor: "miercoles", etiqueta: "Mié" },
  { valor: "jueves", etiqueta: "Jue" },
  { valor: "viernes", etiqueta: "Vie" },
  { valor: "sabado", etiqueta: "Sáb" },
  { valor: "domingo", etiqueta: "Dom" },
];

const ETIQUETA_TIPO_JORNADA: Record<string, string> = {
  normal: "Normal",
  flexible: "Flexible",
  de_confianza: "De confianza",
};

type PatronDia = {
  dia_semana: DiaSemana;
  hora_entrada: string;
  hora_salida: string;
  minutos_comida: number;
};

type JornadaVigente = {
  tipo_jornada: string;
  vigente_desde: string;
  horas_semanales_calculadas: number | null;
  patron_semanal: PatronDia[];
};

function formatearHora(hora: string): string {
  // hora_entrada/hora_salida llegan "HH:MM:SS" (time de Postgres) — sólo interesa HH:MM.
  return hora.slice(0, 5);
}

export function FichaPersonaPage() {
  const { id } = useParams<{ id: string }>();
  const [persona, setPersona] = useState<Persona | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [estadoCarga, setEstadoCarga] = useState<EstadoCarga>("cargando");
  const [alertas, setAlertas] = useState<AlertaRetardo[]>([]);
  // Independiente del resto de la ficha a propósito: el permiso de lectura de alertas
  // (clasificacion_de_tiempo_lectura) es distinto del que ya exige ver la ficha — si el caller
  // no lo tiene, la sección se oculta en vez de tirar abajo toda la página (mismo criterio
  // fail-soft que el resto de bloques opcionales de esta ficha).
  const [estadoAlertas, setEstadoAlertas] = useState<"cargando" | "listo" | "sin_permiso">(
    "cargando",
  );
  const [jornadaVigente, setJornadaVigente] = useState<JornadaVigente | null>(null);
  // "sin_jornada" (404 real del backend) es distinto de "sin_permiso" (403/otro error) — el
  // primero es un dato legítimo que sí se muestra ("sin jornada asignada todavía"), el segundo
  // oculta la tarjeta entera, mismo criterio fail-soft que la de alertas de acá arriba.
  const [estadoJornada, setEstadoJornada] = useState<
    "cargando" | "listo" | "sin_jornada" | "sin_permiso"
  >("cargando");

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

  useEffect(() => {
    if (!id) return;
    const hoy = new Date();
    const inicio = new Date(hoy);
    inicio.setDate(hoy.getDate() - DIAS_VENTANA_RESUMEN_ALERTAS);
    const params = new URLSearchParams({
      persona_id: id,
      desde: aFechaISO(inicio),
      hasta: aFechaISO(hoy),
    });
    apiFetch(`/api/alertas-de-retardo?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`status ${r.status}`);
        return r.json();
      })
      .then((datos: { alertas?: AlertaRetardo[] }) => {
        setAlertas(datos.alertas ?? []);
        setEstadoAlertas("listo");
      })
      .catch(() => setEstadoAlertas("sin_permiso"));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    apiFetch(`/api/personas/${id}/jornada-vigente`)
      .then((r) => {
        if (r.status === 404) {
          setEstadoJornada("sin_jornada");
          return null;
        }
        if (!r.ok) throw new Error(`status ${r.status}`);
        return r.json();
      })
      .then((datos: JornadaVigente | null) => {
        if (!datos || !Array.isArray(datos.patron_semanal)) return;
        setJornadaVigente(datos);
        setEstadoJornada("listo");
      })
      .catch(() => setEstadoJornada("sin_permiso"));
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

        {(estadoJornada === "listo" || estadoJornada === "sin_jornada") && (
          <div className="tarjeta-resumen">
            <div className="fila-cabecera-tarjeta">
              <h3>Jornada asignada</h3>
              <a
                href={`/tiempo/asignacion-jornada?persona_id=${persona.id}`}
                className="boton-con-icono enlace-etiqueta"
              >
                <CalendarClock size={14} aria-hidden="true" />
                {jornadaVigente ? "Renovar jornada" : "Asignar jornada"}
              </a>
            </div>
            {estadoJornada === "sin_jornada" || !jornadaVigente ? (
              <p>Sin jornada vigente asignada.</p>
            ) : (
              <>
                <p className="meta-ficha">
                  <span className="insignia insignia--neutra">
                    {ETIQUETA_TIPO_JORNADA[jornadaVigente.tipo_jornada] ?? jornadaVigente.tipo_jornada}
                  </span>{" "}
                  vigente desde {formatearFecha(jornadaVigente.vigente_desde)}
                  {jornadaVigente.horas_semanales_calculadas != null &&
                    ` · ${jornadaVigente.horas_semanales_calculadas.toFixed(1)} h/semana`}
                </p>
                <div className="calendario-semanal">
                  {DIAS_SEMANA.map(({ valor, etiqueta }) => {
                    const dia = jornadaVigente.patron_semanal.find((p) => p.dia_semana === valor);
                    return (
                      <div
                        key={valor}
                        className={`dia-calendario ${dia ? "dia-calendario--trabaja" : "dia-calendario--libre"}`}
                      >
                        <span className="nombre-dia">{etiqueta}</span>
                        {dia ? (
                          <>
                            <span className="horario-dia">
                              {formatearHora(dia.hora_entrada)}–{formatearHora(dia.hora_salida)}
                            </span>
                            {dia.minutos_comida > 0 && (
                              <span className="comida-dia">{dia.minutos_comida} min comida</span>
                            )}
                          </>
                        ) : (
                          <span className="horario-dia">Libre</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {estadoAlertas === "listo" && (
          <div className="tarjeta-resumen">
            <div className="fila-cabecera-tarjeta">
              <h3>Alertas de retardo</h3>
              <a
                href={`/tiempo/alertas-retardo?persona_id=${persona.id}`}
                className="enlace-etiqueta"
              >
                Ver todas →
              </a>
            </div>
            {alertas.length === 0 ? (
              <p>Sin alertas de retardo en los últimos {DIAS_VENTANA_RESUMEN_ALERTAS + 1} días.</p>
            ) : (
              <ul className="lista-historial-resumido">
                {alertas.slice(0, 5).map((alerta) => (
                  <li key={`${alerta.fecha}-${alerta.motivo}`}>
                    <span className="insignia insignia--aviso">
                      <AlertTriangle size={12} aria-hidden="true" />
                      {ETIQUETA_MOTIVO_ALERTA[alerta.motivo]}
                    </span>
                    <span className="fecha-historial">{formatearFecha(alerta.fecha)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

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

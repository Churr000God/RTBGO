import { type FormEvent, useEffect, useState } from "react";
import { ArrowRight, CalendarClock, Clock } from "lucide-react";

import { apiFetch } from "../lib/apiClient";
import { AppShell } from "../layouts/AppShell";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Input } from "../components/Input";

type Persona = {
  id: string;
  primer_nombre: string;
  apellido_paterno: string;
  estado: string;
};

type TipoJornada = "normal" | "flexible" | "de_confianza";

type DiaSemana =
  | "lunes"
  | "martes"
  | "miercoles"
  | "jueves"
  | "viernes"
  | "sabado"
  | "domingo";

const DIAS: { valor: DiaSemana; etiqueta: string }[] = [
  { valor: "lunes", etiqueta: "Lunes" },
  { valor: "martes", etiqueta: "Martes" },
  { valor: "miercoles", etiqueta: "Miércoles" },
  { valor: "jueves", etiqueta: "Jueves" },
  { valor: "viernes", etiqueta: "Viernes" },
  { valor: "sabado", etiqueta: "Sábado" },
  { valor: "domingo", etiqueta: "Domingo" },
];

type PatronSemanalItem = {
  dia_semana: DiaSemana;
  hora_entrada: string;
  hora_salida: string;
  minutos_comida: number;
};

type PayloadJornada = {
  persona_id: string;
  tipo_jornada: TipoJornada;
  vigente_desde: string;
  patron_semanal: PatronSemanalItem[];
  confirma_cierre_vigente?: boolean;
};

type EstadoCatalogo = "cargando" | "listo" | "error";

async function mensajeDeError(respuesta: Response, generico: string): Promise<string> {
  try {
    const cuerpo = await respuesta.json();
    if (typeof cuerpo?.detail === "string") return cuerpo.detail;
  } catch {
    // cuerpo no era JSON legible — cae al genérico
  }
  return generico;
}

export function AsignarJornadaPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [estadoPersonas, setEstadoPersonas] = useState<EstadoCatalogo>("cargando");
  const [personaId, setPersonaId] = useState(
    () => new URLSearchParams(window.location.search).get("persona_id") ?? "",
  );
  const [diasSeleccionados, setDiasSeleccionados] = useState<Set<DiaSemana>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [payloadPendiente, setPayloadPendiente] = useState<PayloadJornada | null>(null);

  useEffect(() => {
    apiFetch("/api/personas")
      .then((r) => {
        if (!r.ok) throw new Error(`status ${r.status}`);
        return r.json();
      })
      .then((datos: Persona[]) => {
        setPersonas(datos.filter((p) => p.estado === "activo"));
        setEstadoPersonas("listo");
      })
      .catch(() => setEstadoPersonas("error"));
  }, []);

  function alternarDia(dia: DiaSemana) {
    setDiasSeleccionados((anterior) => {
      const siguiente = new Set(anterior);
      if (siguiente.has(dia)) {
        siguiente.delete(dia);
      } else {
        siguiente.add(dia);
      }
      return siguiente;
    });
  }

  async function enviarJornada(payload: PayloadJornada) {
    setEnviando(true);
    try {
      const respuesta = await apiFetch("/api/jornadas-asignadas", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (respuesta.ok) {
        window.location.href = `/personas/${payload.persona_id}`;
        return;
      }
      if (respuesta.status === 409 && !payload.confirma_cierre_vigente) {
        // B1 del proceso (SCJ-PRO-09 §III): ya hay una jornada vigente — no se cierra en
        // silencio, se pide confirmación explícita antes de reintentar con la bandera.
        setPayloadPendiente(payload);
        return;
      }
      setError(await mensajeDeError(respuesta, "No se pudo registrar la asignación de jornada."));
      setPayloadPendiente(null);
    } catch {
      // Falla de red u otro error no-HTTP antes de que apiFetch resuelva una Response — sin
      // este catch, setEnviando(false) nunca corría y el botón quedaba en "Registrando…" para
      // siempre (bug real encontrado por testing probando en navegador).
      setError("No se pudo registrar la asignación de jornada. Revisa tu conexión e intenta de nuevo.");
      setPayloadPendiente(null);
    } finally {
      setEnviando(false);
    }
  }

  async function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    setPayloadPendiente(null);
    const f = new FormData(evento.currentTarget);

    const dias = DIAS.filter((d) => diasSeleccionados.has(d.valor));
    if (dias.length === 0) {
      setError("Selecciona al menos un día del patrón semanal.");
      return;
    }

    const patronSemanal: PatronSemanalItem[] = dias.map(({ valor }) => ({
      dia_semana: valor,
      hora_entrada: String(f.get(`entrada_${valor}`) ?? ""),
      hora_salida: String(f.get(`salida_${valor}`) ?? ""),
      minutos_comida: Number(f.get(`comida_${valor}`) ?? 0),
    }));

    await enviarJornada({
      persona_id: String(f.get("persona_id")),
      tipo_jornada: f.get("tipo_jornada") as TipoJornada,
      vigente_desde: String(f.get("vigente_desde")),
      patron_semanal: patronSemanal,
    });
  }

  function handleConfirmarCierre() {
    if (!payloadPendiente) return;
    enviarJornada({ ...payloadPendiente, confirma_cierre_vigente: true });
  }

  function handleCancelarCierre() {
    setPayloadPendiente(null);
  }

  const sinPersonas = estadoPersonas === "listo" && personas.length === 0;
  const formularioDeshabilitado = sinPersonas || estadoPersonas === "error";

  return (
    <AppShell>
      <form onSubmit={handleSubmit} className="contenedor-pagina">
        <nav className="migas">
          <strong>Asignación de jornada</strong>
        </nav>
        <h1>Asignar jornada</h1>
        <p className="subtitulo-pagina">
          Da de alta o renueva la jornada y el patrón semanal de una persona.
        </p>

        <fieldset className="fieldset-formulario">
          <legend className="encabezado-fieldset">
            <span className="icono-seccion">
              <CalendarClock size={16} aria-hidden="true" />
            </span>
            Datos de la jornada
          </legend>

          <div className="campo">
            <label htmlFor="persona_id">Persona</label>
            <select
              id="persona_id"
              name="persona_id"
              required
              disabled={sinPersonas || estadoPersonas === "error"}
              value={personaId}
              onChange={(evento) => setPersonaId(evento.target.value)}
              aria-describedby={
                sinPersonas || estadoPersonas === "error" ? "persona_id-ayuda" : undefined
              }
            >
              <option value="">Selecciona una persona activa</option>
              {personas.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.primer_nombre} {persona.apellido_paterno}
                </option>
              ))}
            </select>
            {sinPersonas && (
              <small className="ayuda-campo" id="persona_id-ayuda">
                No hay personas activas para asignar.
              </small>
            )}
            {estadoPersonas === "error" && (
              <small className="ayuda-campo" id="persona_id-ayuda">
                No se pudo cargar el padrón de personas.
              </small>
            )}
          </div>

          <div className="campo">
            <span>Tipo de jornada</span>
            <div className="opciones-seleccionables opciones-seleccionables--compacta">
              <label className="opcion-seleccionable">
                <input type="radio" name="tipo_jornada" value="normal" defaultChecked required />
                <span className="texto-opcion">
                  <strong>Normal</strong>
                  <span>Horario fijo, valida tope legal semanal</span>
                </span>
              </label>
              <label className="opcion-seleccionable">
                <input type="radio" name="tipo_jornada" value="flexible" />
                <span className="texto-opcion">
                  <strong>Flexible</strong>
                  <span>Sin tope legal por horario fijo</span>
                </span>
              </label>
              <label className="opcion-seleccionable">
                <input type="radio" name="tipo_jornada" value="de_confianza" />
                <span className="texto-opcion">
                  <strong>De confianza</strong>
                  <span>No registra marca ni banco de horas</span>
                </span>
              </label>
            </div>
          </div>

          <Input
            id="vigente_desde"
            name="vigente_desde"
            label="Vigente desde"
            type="date"
            required
            ayuda="Si la persona ya tiene una jornada vigente, se pedirá confirmar el cierre de esa jornada un día antes de esta fecha."
          />
        </fieldset>

        <fieldset className="fieldset-formulario">
          <legend className="encabezado-fieldset">
            <span className="icono-seccion">
              <Clock size={16} aria-hidden="true" />
            </span>
            Patrón semanal
          </legend>
          <p className="ayuda-campo">Marca los días que trabaja y captura su horario.</p>

          <div className="opciones-seleccionables">
            {DIAS.map(({ valor, etiqueta }) => {
              const marcado = diasSeleccionados.has(valor);
              return (
                <div key={valor}>
                  <label className="opcion-seleccionable">
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={() => alternarDia(valor)}
                    />
                    <span className="texto-opcion">
                      <strong>{etiqueta}</strong>
                    </span>
                  </label>
                  {marcado && (
                    <div className="rejilla-campos">
                      <Input
                        id={`entrada_${valor}`}
                        name={`entrada_${valor}`}
                        label="Hora de entrada"
                        type="time"
                        required
                      />
                      <Input
                        id={`salida_${valor}`}
                        name={`salida_${valor}`}
                        label="Hora de salida"
                        type="time"
                        required
                      />
                      <Input
                        id={`comida_${valor}`}
                        name={`comida_${valor}`}
                        label="Minutos de comida"
                        type="number"
                        min={0}
                        defaultValue={0}
                        required
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>

        {payloadPendiente && (
          <Card>
            <p role="alert">
              Esta persona ya tiene una jornada vigente. ¿Cerrarla y dejar vigente la nueva a partir
              del día anterior a {payloadPendiente.vigente_desde}?
            </p>
            <div className="botonera">
              <Button type="button" onClick={handleCancelarCierre}>
                Cancelar
              </Button>
              <Button
                type="button"
                variante="primario"
                cargando={enviando}
                textoCargando="Cerrando y asignando…"
                onClick={handleConfirmarCierre}
              >
                Sí, cerrar la anterior y asignar
              </Button>
            </div>
          </Card>
        )}

        {error && <p role="alert">{error}</p>}
        <div className="botonera">
          <a href="/personas">Cancelar</a>
          <Button
            type="submit"
            icono={ArrowRight}
            disabled={formularioDeshabilitado || !!payloadPendiente}
            cargando={enviando && !payloadPendiente}
            textoCargando="Registrando…"
          >
            Registrar
          </Button>
        </div>
      </form>
    </AppShell>
  );
}

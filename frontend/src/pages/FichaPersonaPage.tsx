import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { apiFetch } from "../lib/apiClient";

type Persona = {
  id: string;
  primer_nombre: string;
  apellido_paterno: string;
  curp: string;
  estado: string;
  tipo_contrato: string;
  documento_ref: string;
};

type Movimiento = {
  id: string;
  tipo_movimiento: string;
  fecha_efectiva: string;
  motivo: string | null;
};

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

  if (!persona) return <p>Cargando…</p>;

  return (
    <div>
      <h1>
        {persona.primer_nombre} {persona.apellido_paterno}
      </h1>
      <p>Estado: {persona.estado}</p>
      <section>
        <h2>Datos personales</h2>
        <p>CURP: {persona.curp}</p>
      </section>
      <section>
        <h2>Expediente</h2>
        <p>documento_ref: {persona.documento_ref}</p>
        <p>Tipo de contrato: {persona.tipo_contrato}</p>
      </section>
      <section>
        <h2>Historial de estado</h2>
        <ul>
          {movimientos.map((m) => (
            <li key={m.id}>
              {m.fecha_efectiva} — {m.tipo_movimiento} {m.motivo ? `(${m.motivo})` : ""}
            </li>
          ))}
        </ul>
      </section>
      <a href={`/personas/${persona.id}/movimiento`}>Nuevo movimiento</a>
    </div>
  );
}

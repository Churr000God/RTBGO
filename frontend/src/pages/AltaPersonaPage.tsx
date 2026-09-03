import { type FormEvent, useState } from "react";

import { apiFetch } from "../lib/apiClient";

export function AltaPersonaPage() {
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    const f = new FormData(evento.currentTarget);
    const respuesta = await apiFetch("/api/personas", {
      method: "POST",
      body: JSON.stringify({
        primer_nombre: f.get("primer_nombre"),
        segundo_nombre: f.get("segundo_nombre") || null,
        apellido_paterno: f.get("apellido_paterno"),
        apellido_materno: f.get("apellido_materno") || null,
        curp: f.get("curp"),
        rfc: f.get("rfc"),
        nss: f.get("nss"),
        fecha_nacimiento: f.get("fecha_nacimiento"),
        fecha_ingreso: f.get("fecha_ingreso"),
        tipo_contrato: f.get("tipo_contrato"),
        documento_ref: f.get("documento_ref"),
      }),
    });
    if (!respuesta.ok) {
      setError("No se pudo registrar el alta.");
      return;
    }
    const persona = await respuesta.json();
    window.location.href = `/personas/${persona.id}`;
  }

  return (
    <form onSubmit={handleSubmit} className="contenedor-pagina">
      <h1>Alta de persona</h1>
      <label htmlFor="primer_nombre">Primer nombre</label>
      <input id="primer_nombre" name="primer_nombre" required />
      <label htmlFor="segundo_nombre">Segundo nombre</label>
      <input id="segundo_nombre" name="segundo_nombre" />
      <label htmlFor="apellido_paterno">Apellido paterno</label>
      <input id="apellido_paterno" name="apellido_paterno" required />
      <label htmlFor="apellido_materno">Apellido materno</label>
      <input id="apellido_materno" name="apellido_materno" />
      <label htmlFor="curp">CURP</label>
      <input id="curp" name="curp" required maxLength={18} />
      <label htmlFor="rfc">RFC</label>
      <input id="rfc" name="rfc" required maxLength={13} />
      <label htmlFor="nss">NSS</label>
      <input id="nss" name="nss" required maxLength={11} />
      <label htmlFor="fecha_nacimiento">Fecha de nacimiento</label>
      <input id="fecha_nacimiento" name="fecha_nacimiento" type="date" required />
      <label htmlFor="fecha_ingreso">Fecha de ingreso</label>
      <input id="fecha_ingreso" name="fecha_ingreso" type="date" required />
      <fieldset>
        <legend>Tipo de contrato</legend>
        <label>
          <input type="radio" name="tipo_contrato" value="indefinido" defaultChecked /> Indefinido
        </label>
        <label>
          <input type="radio" name="tipo_contrato" value="prestacion_servicios" /> Prestación de
          servicios
        </label>
        <label>
          <input type="radio" name="tipo_contrato" value="por_proyecto" /> Por proyecto
        </label>
      </fieldset>
      <label htmlFor="documento_ref">documento_ref</label>
      <input id="documento_ref" name="documento_ref" placeholder="RTB-__-__" required />
      {error && <p role="alert">{error}</p>}
      <button type="submit">Registrar alta</button>
    </form>
  );
}

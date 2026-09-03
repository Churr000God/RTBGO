import { type FormEvent, useEffect, useState } from "react";

import { apiFetch } from "../lib/apiClient";

type PersonaOpcion = { id: string; primer_nombre: string; apellido_paterno: string };

export function AltaUsuarioPage() {
  const [personas, setPersonas] = useState<PersonaOpcion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    apiFetch("/api/personas")
      .then((r) => r.json())
      .then(setPersonas);
  }, []);

  async function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    const f = new FormData(evento.currentTarget);
    const respuesta = await apiFetch("/api/usuarios", {
      method: "POST",
      body: JSON.stringify({
        persona_id: f.get("persona_id"),
        correo: f.get("correo"),
        nombre_usuario: f.get("nombre_usuario"),
      }),
    });
    if (!respuesta.ok) {
      setError("No se pudo enviar la invitación.");
      return;
    }
    setEnviado(true);
  }

  if (enviado) {
    return (
      <p className="contenedor-pagina" style={{ marginTop: "2.5rem" }}>
        Invitación enviada.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="contenedor-pagina">
      <h1>Alta de usuario</h1>
      <label htmlFor="persona_id">Persona</label>
      <select id="persona_id" name="persona_id" required>
        <option value="">Selecciona una persona</option>
        {personas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.primer_nombre} {p.apellido_paterno}
          </option>
        ))}
      </select>
      <label htmlFor="correo">Correo</label>
      <input id="correo" name="correo" type="email" required />
      <label htmlFor="nombre_usuario">Nombre de usuario</label>
      <input id="nombre_usuario" name="nombre_usuario" required />
      {error && <p role="alert">{error}</p>}
      <button type="submit">Enviar invitación</button>
    </form>
  );
}

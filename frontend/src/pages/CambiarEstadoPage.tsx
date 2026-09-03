import { type FormEvent, useState } from "react";
import { useParams } from "react-router-dom";

import { apiFetch } from "../lib/apiClient";

export function CambiarEstadoPage() {
  const { id } = useParams<{ id: string }>();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    const f = new FormData(evento.currentTarget);
    const respuesta = await apiFetch(`/api/personas/${id}/movimientos`, {
      method: "POST",
      body: JSON.stringify({
        tipo_movimiento: f.get("tipo_movimiento"),
        motivo: f.get("motivo"),
      }),
    });
    if (!respuesta.ok) {
      setError("No se pudo registrar el movimiento.");
      return;
    }
    window.location.href = `/personas/${id}`;
  }

  return (
    <form onSubmit={handleSubmit} className="contenedor-pagina">
      <h1>Cambio de estado</h1>
      <fieldset>
        <legend>Nuevo estado</legend>
        <label>
          <input type="radio" name="tipo_movimiento" value="suspension" required /> Suspensión
        </label>
        <label>
          <input type="radio" name="tipo_movimiento" value="reactivacion" /> Reactivación
        </label>
        <label>
          <input type="radio" name="tipo_movimiento" value="baja_definitiva" /> Baja definitiva
        </label>
      </fieldset>
      <label htmlFor="motivo">Motivo</label>
      <textarea id="motivo" name="motivo" required />
      {error && <p role="alert">{error}</p>}
      <button type="submit">Confirmar</button>
    </form>
  );
}

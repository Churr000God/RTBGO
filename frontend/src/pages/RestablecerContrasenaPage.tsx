import { type FormEvent, useState } from "react";

import { AuthLayout } from "../layouts/AuthLayout";
import { supabase } from "../lib/supabaseClient";

export function RestablecerContrasenaPage() {
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  async function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = new FormData(evento.currentTarget);
    const nueva = String(formulario.get("nueva"));
    const confirmar = String(formulario.get("confirmar"));
    if (nueva !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    const { error: errorUpdate } = await supabase.auth.updateUser({ password: nueva });
    if (errorUpdate) {
      setError("No se pudo actualizar la contraseña.");
      return;
    }
    setListo(true);
  }

  if (listo) {
    return (
      <AuthLayout titulo="Contraseña actualizada" bajada="Ya puedes iniciar sesión.">
        <a href="/">Ir a iniciar sesión</a>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout titulo="Define tu nueva contraseña" bajada="">
      <form onSubmit={handleSubmit}>
        <label htmlFor="nueva">Nueva contraseña</label>
        <input id="nueva" name="nueva" type="password" required minLength={8} />
        <label htmlFor="confirmar">Confirmar contraseña</label>
        <input id="confirmar" name="confirmar" type="password" required minLength={8} />
        {error && <p role="alert">{error}</p>}
        <button type="submit">Guardar</button>
      </form>
    </AuthLayout>
  );
}

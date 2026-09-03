import { type FormEvent, useState } from "react";

import { AuthLayout } from "../layouts/AuthLayout";
import { supabase } from "../lib/supabaseClient";

export function OlvideContrasenaPage() {
  const [enviado, setEnviado] = useState(false);

  async function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const correo = String(new FormData(evento.currentTarget).get("correo"));
    await supabase.auth.resetPasswordForEmail(correo, {
      redirectTo: `${window.location.origin}/restablecer-contrasena`,
    });
    setEnviado(true);
  }

  return (
    <AuthLayout titulo="Recupera tu acceso" bajada="Te enviamos un enlace a tu correo.">
      {enviado ? (
        <p>Revisa tu correo para continuar.</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <label htmlFor="correo">Correo electrónico</label>
          <input id="correo" name="correo" type="email" required />
          <button type="submit">Enviar enlace</button>
        </form>
      )}
    </AuthLayout>
  );
}

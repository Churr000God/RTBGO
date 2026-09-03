import { type FormEvent, useState } from "react";

import { AuthLayout } from "../layouts/AuthLayout";
import { supabase } from "../lib/supabaseClient";

function leerErrorDelEnlace(): string | null {
  if (typeof window === "undefined") return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const codigo = hash.get("error_code");
  if (codigo === "otp_expired") {
    return "Este enlace venció. Solicitá uno nuevo.";
  }
  if (hash.get("error")) {
    return "Este enlace ya no es válido. Solicitá uno nuevo.";
  }
  return null;
}

export function RestablecerContrasenaPage() {
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [errorEnlace] = useState<string | null>(leerErrorDelEnlace);

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

  if (errorEnlace) {
    return (
      <AuthLayout titulo="Define tu nueva contraseña" bajada="">
        <p role="alert">{errorEnlace}</p>
        <a href="/olvide-contrasena">Solicitar un enlace nuevo</a>
      </AuthLayout>
    );
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
        <input id="nueva" name="nueva" type={mostrarNueva ? "text" : "password"} required minLength={8} />
        <button type="button" onClick={() => setMostrarNueva((v) => !v)} style={{ alignSelf: "flex-end" }}>
          {mostrarNueva ? "Ocultar" : "Mostrar"}
        </button>
        <label htmlFor="confirmar">Confirmar contraseña</label>
        <input
          id="confirmar"
          name="confirmar"
          type={mostrarConfirmar ? "text" : "password"}
          required
          minLength={8}
        />
        <button type="button" onClick={() => setMostrarConfirmar((v) => !v)} style={{ alignSelf: "flex-end" }}>
          {mostrarConfirmar ? "Ocultar" : "Mostrar"}
        </button>
        {error && <p role="alert">{error}</p>}
        <button type="submit">Guardar</button>
      </form>
    </AuthLayout>
  );
}

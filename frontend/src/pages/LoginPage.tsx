import { type FormEvent, useState } from "react";

import { supabase } from "../lib/supabaseClient";
import { AuthLayout } from "../layouts/AuthLayout";

export function LoginPage() {
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    const formulario = new FormData(evento.currentTarget);
    const { error: errorLogin } = await supabase.auth.signInWithPassword({
      email: String(formulario.get("correo")),
      password: String(formulario.get("contrasena")),
    });
    if (errorLogin) {
      setError("Correo o contraseña incorrectos.");
      return;
    }

    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== aal.nextLevel) {
      window.location.href = "/verificar-totp";
    } else if (aal?.nextLevel === "aal1") {
      window.location.href = "/configurar-2fa";
    } else {
      window.location.href = "/personas";
    }
  }

  return (
    <AuthLayout
      titulo="El tiempo de tu gente, en orden."
      bajada="Control de jornada, marcas, banco de horas y gestión de personas en una sola plataforma."
    >
      <h2>Iniciar sesión</h2>
      <p>Accede con tu correo corporativo.</p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="correo">Correo electrónico</label>
        <input id="correo" name="correo" type="email" required />
        <label htmlFor="contrasena">Contraseña</label>
        <input id="contrasena" name="contrasena" type="password" required />
        <a href="/olvide-contrasena" style={{ fontSize: "0.85rem", alignSelf: "flex-end" }}>
          ¿Olvidaste tu contraseña?
        </a>
        {error && <p role="alert">{error}</p>}
        <button type="submit">Iniciar sesión</button>
      </form>
    </AuthLayout>
  );
}

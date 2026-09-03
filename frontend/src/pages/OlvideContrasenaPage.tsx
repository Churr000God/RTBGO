import { type FormEvent, useState } from "react";
import { Clock, KeyRound, Mail, Send } from "lucide-react";

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
      <span className="insignia insignia--exito" style={{ background: "var(--superficie)" }}>
        <KeyRound size={16} aria-hidden="true" />
      </span>
      <h2>¿Olvidaste tu contraseña?</h2>
      {enviado ? (
        <p>Revisa tu correo para continuar.</p>
      ) : (
        <>
          <p>Escribe tu correo corporativo y te enviaremos un enlace para crear una nueva.</p>
          <form onSubmit={handleSubmit}>
            <label htmlFor="correo">Correo electrónico</label>
            <div className="campo-con-icono">
              <Mail size={16} className="icono-campo" aria-hidden="true" />
              <input
                id="correo"
                name="correo"
                type="email"
                placeholder="nombre@distribuidoracentral.mx"
                required
              />
            </div>
            <button type="submit" className="boton-con-icono">
              Enviar enlace de recuperación
              <Send size={16} aria-hidden="true" />
            </button>
            <p className="tarjeta-info">
              <Clock size={16} aria-hidden="true" />
              El enlace caduca en 30 minutos y sólo puede usarse una vez.
            </p>
          </form>
          <p className="texto-ayuda">
            ¿No recibes el correo? Revisa tu bandeja de no deseados o escribe a Recursos Humanos.
          </p>
        </>
      )}
    </AuthLayout>
  );
}

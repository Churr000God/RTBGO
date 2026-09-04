import { type FormEvent, useState } from "react";
import { AlertCircle, ArrowRight, Eye, EyeOff, Info, Lock, Mail } from "lucide-react";

import { supabase } from "../lib/supabaseClient";
import { AuthLayout } from "../layouts/AuthLayout";
import { registrarErrorAuth } from "../lib/erroresAuth";

const INTENTOS_INICIALES = 5;
const BLOQUEO_MS = 15 * 60 * 1000;

export function LoginPage() {
  const [error, setError] = useState(false);
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [intentosRestantes, setIntentosRestantes] = useState(INTENTOS_INICIALES);
  const [bloqueadoHasta, setBloqueadoHasta] = useState<number | null>(null);

  async function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (bloqueadoHasta && Date.now() < bloqueadoHasta) {
      setError(true);
      return;
    }

    const formulario = new FormData(evento.currentTarget);
    const { error: errorLogin } = await supabase.auth.signInWithPassword({
      email: String(formulario.get("correo")),
      password: String(formulario.get("contrasena")),
    });
    if (errorLogin) {
      registrarErrorAuth("LoginPage.signInWithPassword", errorLogin);
      const restantes = intentosRestantes - 1;
      if (restantes <= 0) {
        setBloqueadoHasta(Date.now() + BLOQUEO_MS);
        setIntentosRestantes(INTENTOS_INICIALES);
      } else {
        setIntentosRestantes(restantes);
      }
      setError(true);
      return;
    }

    setError(false);
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== aal.nextLevel) {
      window.location.href = "/verificar-totp";
    } else if (aal?.nextLevel === "aal1") {
      window.location.href = "/configurar-2fa";
    } else {
      window.location.href = "/personas";
    }
  }

  const bloqueado = Boolean(bloqueadoHasta && Date.now() < bloqueadoHasta);
  const minutosRestantesBloqueo = bloqueadoHasta
    ? Math.max(1, Math.ceil((bloqueadoHasta - Date.now()) / 60000))
    : 0;

  return (
    <AuthLayout
      titulo={error ? "No pudimos verificar tu acceso." : "El tiempo de tu gente, en orden."}
      bajada={
        error
          ? "Revisa tu correo corporativo y tu contraseña antes de volver a intentarlo. Tras cinco intentos fallidos la cuenta se bloquea de forma temporal por seguridad."
          : "Control de jornada, marcas, banco de horas y gestión de personas en una sola plataforma."
      }
    >
      <h2>Iniciar sesión</h2>
      <p>Accede con tu correo corporativo.</p>
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="tarjeta-error" role="alert">
            <strong>
              <AlertCircle size={16} aria-hidden="true" />
              Credenciales inválidas
            </strong>
            <p>
              {bloqueado
                ? "Cuenta bloqueada temporalmente por seguridad."
                : "El correo o la contraseña no coinciden. Verifica los datos e inténtalo de nuevo."}
            </p>
            <p className="intentos-restantes">
              {bloqueado
                ? `Volvé a intentar en ${minutosRestantesBloqueo} minuto${minutosRestantesBloqueo === 1 ? "" : "s"}.`
                : `Te quedan ${intentosRestantes} intentos antes de bloquear la cuenta por 15 minutos.`}
            </p>
          </div>
        )}
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
        <div className="fila-etiqueta">
          <label htmlFor="contrasena">Contraseña</label>
          <a href="/olvide-contrasena" className="enlace-etiqueta">
            ¿Olvidaste tu contraseña?
          </a>
        </div>
        <div className={`campo-con-icono${error ? " invalido" : ""}`}>
          <Lock size={16} className="icono-campo" aria-hidden="true" />
          <input
            id="contrasena"
            name="contrasena"
            type={mostrarContrasena ? "text" : "password"}
            placeholder="Escribe tu contraseña"
            required
            aria-invalid={error || undefined}
            aria-describedby={error ? "hint-contrasena" : undefined}
          />
          <button
            type="button"
            className="boton-ojo"
            onClick={() => setMostrarContrasena((v) => !v)}
            aria-label={mostrarContrasena ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {mostrarContrasena ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {error && (
          <p className="hint-campo" id="hint-contrasena">
            <Info size={14} aria-hidden="true" />
            Distingue mayúsculas y minúsculas.
          </p>
        )}
        <button type="submit" className="boton-con-icono" disabled={bloqueado}>
          {error ? "Reintentar acceso" : "Iniciar sesión"}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </form>
      <p className="texto-ayuda">¿Problemas para entrar? Escribe a Recursos Humanos.</p>
    </AuthLayout>
  );
}

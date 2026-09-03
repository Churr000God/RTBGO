import { type FormEvent, useMemo, useState } from "react";
import { Check, CheckCircle2, Circle, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";

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

const REQUISITOS = [
  { clave: "longitud", texto: "Al menos 12 caracteres", cumple: (v: string) => v.length >= 12 },
  {
    clave: "mayus",
    texto: "Una mayúscula y una minúscula",
    cumple: (v: string) => /[a-z]/.test(v) && /[A-Z]/.test(v),
  },
  {
    clave: "numero",
    texto: "Un número o símbolo",
    cumple: (v: string) => /[0-9]/.test(v) || /[^A-Za-z0-9]/.test(v),
  },
];

export function RestablecerContrasenaPage() {
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [errorEnlace] = useState<string | null>(leerErrorDelEnlace);
  const [nuevaValor, setNuevaValor] = useState("");

  const cumplidos = useMemo(
    () => REQUISITOS.map((requisito) => requisito.cumple(nuevaValor)),
    [nuevaValor]
  );
  const totalCumplidos = cumplidos.filter(Boolean).length;
  const fuerza =
    totalCumplidos === REQUISITOS.length ? "fuerte" : totalCumplidos >= 1 ? "media" : "debil";
  const etiquetaFuerza = { debil: "Débil", media: "Media", fuerte: "Fuerte" }[fuerza];

  async function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = new FormData(evento.currentTarget);
    const nueva = String(formulario.get("nueva"));
    const confirmar = String(formulario.get("confirmar"));
    if (nueva !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (totalCumplidos < REQUISITOS.length) {
      setError("La contraseña no cumple los requisitos de seguridad.");
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
      <span className="insignia insignia--exito">
        <ShieldCheck size={14} aria-hidden="true" />
        Enlace verificado
      </span>
      <h2>Restablece tu contraseña</h2>
      <p>Define la nueva contraseña de tu cuenta corporativa y confírmala para guardarla.</p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="nueva">Nueva contraseña</label>
        <div className="campo-con-icono">
          <Lock size={16} className="icono-campo" aria-hidden="true" />
          <input
            id="nueva"
            name="nueva"
            type={mostrarNueva ? "text" : "password"}
            required
            minLength={12}
            value={nuevaValor}
            onChange={(evento) => setNuevaValor(evento.target.value)}
          />
          <button
            type="button"
            className="boton-ojo"
            onClick={() => setMostrarNueva((v) => !v)}
            aria-label={mostrarNueva ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {mostrarNueva ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {nuevaValor && (
          <div className="medidor-fuerza">
            <div className="barras">
              {REQUISITOS.map((requisito, indice) => (
                <span
                  key={requisito.clave}
                  className={`barra ${indice < totalCumplidos ? `activa-${fuerza}` : ""}`}
                />
              ))}
            </div>
            <div className="etiqueta">
              <span>Seguridad de la contraseña</span>
              <strong>{etiquetaFuerza}</strong>
            </div>
          </div>
        )}
        <label htmlFor="confirmar">Confirmar contraseña</label>
        <div className="campo-con-icono">
          <Lock size={16} className="icono-campo" aria-hidden="true" />
          <input
            id="confirmar"
            name="confirmar"
            type={mostrarConfirmar ? "text" : "password"}
            required
            minLength={12}
          />
          <button
            type="button"
            className="boton-ojo"
            onClick={() => setMostrarConfirmar((v) => !v)}
            aria-label={mostrarConfirmar ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {mostrarConfirmar ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <ul className="lista-requisitos">
          {REQUISITOS.map((requisito, indice) => (
            <li key={requisito.clave} className={cumplidos[indice] ? "cumplido" : ""}>
              {cumplidos[indice] ? (
                <CheckCircle2 size={16} aria-hidden="true" />
              ) : (
                <Circle size={16} aria-hidden="true" />
              )}
              {requisito.texto}
            </li>
          ))}
        </ul>
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="boton-con-icono">
          Guardar contraseña
          <Check size={16} aria-hidden="true" />
        </button>
      </form>
      <p className="texto-ayuda">
        Al guardar se cerrarán todas tus sesiones activas y deberás iniciar sesión de nuevo.
      </p>
    </AuthLayout>
  );
}

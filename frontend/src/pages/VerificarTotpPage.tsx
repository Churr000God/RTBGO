import { type FormEvent, useState } from "react";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";

import { AuthLayout } from "../layouts/AuthLayout";
import { supabase } from "../lib/supabaseClient";

type Props = { factorId: string };

export function VerificarTotpPage({ factorId }: Props) {
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    const codigo = String(new FormData(evento.currentTarget).get("codigo"));
    const { data: challenge, error: errorChallenge } = await supabase.auth.mfa.challenge({
      factorId,
    });
    if (errorChallenge || !challenge) {
      setError("No se pudo iniciar la verificación.");
      return;
    }
    const { error: errorVerify } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: codigo,
    });
    if (errorVerify) {
      setError("Código incorrecto.");
      return;
    }
    window.location.href = "/personas";
  }

  return (
    <AuthLayout titulo="Verifica tu identidad" bajada="Ingresa el código de tu app autenticadora.">
      <span className="insignia insignia--exito">
        <ShieldCheck size={14} aria-hidden="true" />
      </span>
      <h2>Verificación en dos pasos</h2>
      <p>Abre tu app autenticadora e ingresa el código de 6 dígitos que aparece para Kairos.</p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="codigo">Código de verificación</label>
        <input id="codigo" name="codigo" inputMode="numeric" maxLength={6} required />
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="boton-con-icono">
          Verificar
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </form>
      <a href="/" className="boton-con-icono" style={{ fontSize: "0.85rem" }}>
        <ArrowLeft size={14} aria-hidden="true" />
        Volver al inicio de sesión
      </a>
    </AuthLayout>
  );
}

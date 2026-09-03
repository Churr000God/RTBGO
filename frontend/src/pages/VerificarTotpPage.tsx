import { type FormEvent, useState } from "react";

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
      <form onSubmit={handleSubmit}>
        <label htmlFor="codigo">Código de verificación</label>
        <input id="codigo" name="codigo" inputMode="numeric" maxLength={6} required />
        {error && <p role="alert">{error}</p>}
        <button type="submit">Verificar</button>
      </form>
      <a href="/" style={{ fontSize: "0.85rem" }}>
        Volver al inicio de sesión
      </a>
    </AuthLayout>
  );
}

import { useEffect, useState } from "react";

import { AuthLayout } from "../layouts/AuthLayout";
import { supabase } from "../lib/supabaseClient";
import { VerificarTotpPage } from "./VerificarTotpPage";

/**
 * Ruta /verificar-totp para logins siguientes (no el enrolamiento — ese ya trae su propio
 * factorId de Configurar2FAPage). Busca el factor TOTP ya verificado de la sesión actual.
 */
export function VerificarTotpRoute() {
  const [factorId, setFactorId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const factor = data?.totp.find((f) => f.status === "verified");
      if (factor) {
        setFactorId(factor.id);
      }
    });
  }, []);

  if (!factorId) {
    return (
      <AuthLayout titulo="Verifica tu identidad" bajada="">
        <p>Cargando…</p>
      </AuthLayout>
    );
  }

  return <VerificarTotpPage factorId={factorId} />;
}

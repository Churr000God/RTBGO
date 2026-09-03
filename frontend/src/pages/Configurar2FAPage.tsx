import { useEffect, useState } from "react";

import { AuthLayout } from "../layouts/AuthLayout";
import { supabase } from "../lib/supabaseClient";
import { VerificarTotpPage } from "./VerificarTotpPage";

export function Configurar2FAPage() {
  const [qr, setQr] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [listoParaVerificar, setListoParaVerificar] = useState(false);

  useEffect(() => {
    supabase.auth.mfa.enroll({ factorType: "totp" }).then(({ data, error }) => {
      if (!error && data) {
        setQr(data.totp.qr_code);
        setFactorId(data.id);
      }
    });
  }, []);

  if (factorId && listoParaVerificar) {
    return <VerificarTotpPage factorId={factorId} />;
  }

  return (
    <AuthLayout titulo="Protege tu cuenta" bajada="Escanea el código con tu app autenticadora.">
      {qr ? (
        <>
          <img src={qr} alt="Código QR para configurar 2FA" />
          <button type="button" onClick={() => setListoParaVerificar(true)}>
            Ya la agregué, continuar
          </button>
        </>
      ) : (
        <p>Generando código…</p>
      )}
    </AuthLayout>
  );
}

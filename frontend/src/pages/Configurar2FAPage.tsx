import { useEffect, useState } from "react";

import { AuthLayout } from "../layouts/AuthLayout";
import { supabase } from "../lib/supabaseClient";
import { VerificarTotpPage } from "./VerificarTotpPage";

export function Configurar2FAPage() {
  const [qr, setQr] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [listoParaVerificar, setListoParaVerificar] = useState(false);
  const [yaConfigurado, setYaConfigurado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data, error: errorListado }) => {
      if (errorListado) {
        setError("No se pudo comprobar el estado de tu verificación en dos pasos.");
        return;
      }
      const yaTieneTotp = data?.totp.some((factor) => factor.status === "verified");
      if (yaTieneTotp) {
        setYaConfigurado(true);
        return;
      }
      supabase.auth.mfa.enroll({ factorType: "totp" }).then(({ data: enrolado, error: errorEnroll }) => {
        if (errorEnroll || !enrolado) {
          setError("No se pudo generar el código. Intenta de nuevo.");
          return;
        }
        setQr(enrolado.totp.qr_code);
        setFactorId(enrolado.id);
      });
    });
  }, []);

  if (factorId && listoParaVerificar) {
    return <VerificarTotpPage factorId={factorId} />;
  }

  if (yaConfigurado) {
    return (
      <AuthLayout titulo="Protege tu cuenta" bajada="Escanea el código con tu app autenticadora.">
        <p>Tu cuenta ya tiene la verificación en dos pasos activa.</p>
        <a href="/personas">Ir a Personas</a>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout titulo="Protege tu cuenta" bajada="Escanea el código con tu app autenticadora.">
      {error && <p role="alert">{error}</p>}
      {!error && (qr ? (
        <>
          <img src={qr} alt="Código QR para configurar 2FA" />
          <button type="button" onClick={() => setListoParaVerificar(true)}>
            Ya la agregué, continuar
          </button>
        </>
      ) : (
        <p>Generando código…</p>
      ))}
    </AuthLayout>
  );
}

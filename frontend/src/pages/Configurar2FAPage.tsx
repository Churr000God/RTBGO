import { useEffect, useState } from "react";
import { AlertCircle, ArrowRight, Loader2, ShieldCheck } from "lucide-react";

import { AuthLayout } from "../layouts/AuthLayout";
import { supabase } from "../lib/supabaseClient";
import { registrarErrorAuth } from "../lib/erroresAuth";
import { VerificarTotpPage } from "./VerificarTotpPage";

const INSIGNIA_PASO = { icono: ShieldCheck, texto: "Paso 2 de 3 · Seguridad" };

export function Configurar2FAPage() {
  const [qr, setQr] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [listoParaVerificar, setListoParaVerificar] = useState(false);
  const [yaConfigurado, setYaConfigurado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data, error: errorListado }) => {
      if (errorListado) {
        registrarErrorAuth("Configurar2FAPage.listFactors", errorListado);
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
          registrarErrorAuth("Configurar2FAPage.enroll", errorEnroll);
          setError("No se pudo generar el código. Intenta de nuevo.");
          return;
        }
        setQr(enrolado.totp.qr_code);
        setFactorId(enrolado.id);
      });
    });
  }, []);

  if (factorId && listoParaVerificar) {
    return (
      <VerificarTotpPage
        factorId={factorId}
        tituloPanel="Protege tu cuenta"
        bajadaPanel="Escanea el código con tu app autenticadora."
        insignia={INSIGNIA_PASO}
      />
    );
  }

  if (yaConfigurado) {
    return (
      <AuthLayout
        titulo="Protege tu cuenta"
        bajada="Escanea el código con tu app autenticadora."
        insignia={INSIGNIA_PASO}
      >
        <p className="tarjeta-info">
          <ShieldCheck size={16} aria-hidden="true" />
          Tu cuenta ya tiene la verificación en dos pasos activa.
        </p>
        <a href="/personas" className="boton-con-icono">
          Ir a Personas
          <ArrowRight size={14} aria-hidden="true" />
        </a>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      titulo="Protege tu cuenta"
      bajada="Escanea el código con tu app autenticadora."
      insignia={INSIGNIA_PASO}
    >
      {error && (
        <div className="tarjeta-error" role="alert">
          <strong>
            <AlertCircle size={16} aria-hidden="true" />
            No se pudo continuar
          </strong>
          <p>{error}</p>
        </div>
      )}
      {!error && (qr ? (
        <>
          <img src={qr} alt="Código QR para configurar 2FA" />
          <button type="button" className="boton-con-icono" onClick={() => setListoParaVerificar(true)}>
            Ya la agregué, continuar
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </>
      ) : (
        <p className="boton-con-icono">
          <Loader2 size={16} className="icono-girando" aria-hidden="true" />
          Generando código…
        </p>
      ))}
    </AuthLayout>
  );
}

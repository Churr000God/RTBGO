import { Clock, Info, Lock, Mail, Phone } from "lucide-react";

import { AuthLayout } from "../layouts/AuthLayout";

type Motivo = "suspension" | "baja_definitiva" | "sin_persona" | "sin_usuario";

type Copy = {
  tituloPanel: string;
  bajadaPanel: string;
  tituloTarjeta: string;
  bajadaTarjeta: string;
  siguientePaso: string;
};

const COPY: Record<Motivo, Copy> = {
  suspension: {
    tituloPanel: "Este acceso está en pausa",
    bajadaPanel:
      "La cuenta fue suspendida por Recursos Humanos. Nadie más puede reactivarla, y ninguna marca de jornada se registra mientras siga en ese estado.",
    tituloTarjeta: "Tu cuenta no está activa",
    bajadaTarjeta:
      "El acceso a Kairos fue suspendido para este usuario. Mientras la cuenta permanezca en ese estado no es posible iniciar sesión ni registrar marcas de jornada.",
    siguientePaso: "La reactivación sólo la puede realizar Recursos Humanos.",
  },
  baja_definitiva: {
    tituloPanel: "Este acceso ya no está disponible",
    bajadaPanel:
      "Tu relación laboral con la empresa fue cerrada. El acceso a Kairos no puede reactivarse para cuentas dadas de baja.",
    tituloTarjeta: "Tu cuenta fue dada de baja",
    bajadaTarjeta:
      "El acceso a Kairos fue cerrado de forma definitiva para este usuario. No es posible iniciar sesión ni registrar marcas de jornada.",
    siguientePaso: "Si consideras que esto es un error, comunícate con Recursos Humanos.",
  },
  sin_persona: {
    tituloPanel: "No encontramos tu perfil",
    bajadaPanel:
      "Tu cuenta de acceso no está vinculada todavía a un registro de persona en el sistema.",
    tituloTarjeta: "No pudimos verificar tu perfil",
    bajadaTarjeta:
      "Tu cuenta existe, pero no encontramos un registro de persona asociado. Esto puede deberse a un alta incompleta.",
    siguientePaso: "Contacta a Recursos Humanos para completar tu registro.",
  },
  sin_usuario: {
    tituloPanel: "No encontramos tu perfil",
    bajadaPanel:
      "Tu cuenta de acceso no está vinculada todavía a un registro de persona en el sistema.",
    tituloTarjeta: "No pudimos verificar tu perfil",
    bajadaTarjeta:
      "Tu cuenta existe, pero no encontramos un registro de persona asociado. Esto puede deberse a un alta incompleta.",
    siguientePaso: "Contacta a Recursos Humanos para completar tu registro.",
  },
};

function leerMotivo(): Motivo {
  if (typeof window === "undefined") return "suspension";
  const parametro = new URLSearchParams(window.location.search).get("motivo");
  if (parametro === "baja_definitiva" || parametro === "sin_persona" || parametro === "sin_usuario") {
    return parametro;
  }
  return "suspension";
}

export function CuentaSuspendidaPage() {
  const copy = COPY[leerMotivo()];

  return (
    <AuthLayout titulo={copy.tituloPanel} bajada={copy.bajadaPanel}>
      <div className="contenido-centrado">
        <div className="icono-tarjeta">
          <Lock size={22} aria-hidden="true" />
        </div>
        <span className="eyebrow">Error 403 · Acceso denegado</span>
        <h2>{copy.tituloTarjeta}</h2>
        <p>{copy.bajadaTarjeta}</p>
        <p className="eyebrow-seccion">Siguiente paso</p>
        <p className="texto-siguiente-paso">{copy.siguientePaso}</p>

        {/* Datos de contacto de RH hardcodeados a propósito: Distribuidora Central es la
            empresa ficticia del caso de estudio (docs/00-contexto/SCJ-ANO-01_*.md) — no hay
            (ni debe inventarse) un endpoint de configuración real para esto. */}
        <div className="tarjeta-contacto">
          <h3>Contacta a Recursos Humanos</h3>
          <div className="fila">
            <span className="etiqueta">
              <Mail size={14} aria-hidden="true" />
              Correo
            </span>
            <span className="valor">rh@distribuidoracentral.mx</span>
          </div>
          <div className="fila">
            <span className="etiqueta">
              <Phone size={14} aria-hidden="true" />
              Extensión
            </span>
            <span className="valor">2250-1100 ext. 214</span>
          </div>
          <div className="fila">
            <span className="etiqueta">
              <Clock size={14} aria-hidden="true" />
              Horario de atención
            </span>
            <span className="valor">Lunes a viernes, 8:00 a 17:00</span>
          </div>
        </div>

        <p className="tarjeta-info">
          <Info size={14} aria-hidden="true" />
          Al escribir, incluye tu nombre completo para agilizar la revisión.
        </p>
        <p className="texto-ayuda">Esta pantalla no permite reintentar el inicio de sesión.</p>
      </div>
    </AuthLayout>
  );
}

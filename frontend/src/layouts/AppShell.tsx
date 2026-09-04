import { useEffect, useState, type ReactNode } from "react";

import { apiFetch } from "../lib/apiClient";
import { supabase } from "../lib/supabaseClient";
import { registrarErrorAuth } from "../lib/erroresAuth";

type EstadoAcceso = "verificando" | "permitido";

const NAV_ITEMS = [
  { label: "Panel", href: "/", disponible: false },
  { label: "Personas", href: "/personas", disponible: true },
  { label: "Marcas", href: "/marcas", disponible: false },
  { label: "Jornadas", href: "/jornadas", disponible: false },
  { label: "Autorizaciones", href: "/autorizaciones", disponible: false },
  { label: "Reportes", href: "/reportes", disponible: false },
  { label: "Configuración", href: "/configuracion", disponible: false },
];

type Props = { children: ReactNode };

export function AppShell({ children }: Props) {
  const rutaActual = typeof window !== "undefined" ? window.location.pathname : "";
  const [correoUsuario, setCorreoUsuario] = useState<string | null>(null);
  const [estadoAcceso, setEstadoAcceso] = useState<EstadoAcceso>("verificando");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCorreoUsuario(data.user?.email ?? null);
    });
  }, []);

  useEffect(() => {
    // Guard de sesión: LoginPage ya chequea /api/sesion al loguearse, pero eso no cubre a
    // alguien que ya tenía una sesión bloqueada y navega/recarga directo a una ruta interna
    // (AppShell envuelve todas). Fail-open (mismo criterio que LoginPage, D8 del plan): si
    // /api/sesion falla, no se bloquea — la RLS de Postgres sigue siendo el control real.
    let vivo = true;

    apiFetch("/api/sesion")
      .then(async (respuesta) => {
        if (!respuesta.ok) {
          if (vivo) setEstadoAcceso("permitido");
          return;
        }
        const sesion = await respuesta.json();
        if (!vivo) return;
        if (!sesion.acceso_permitido) {
          await supabase.auth.signOut();
          window.location.href = `/cuenta-suspendida?motivo=${sesion.motivo_bloqueo ?? "suspension"}`;
          return;
        }
        setEstadoAcceso("permitido");
      })
      .catch((error) => {
        registrarErrorAuth("AppShell.sesion", error);
        if (vivo) setEstadoAcceso("permitido");
      });

    return () => {
      vivo = false;
    };
  }, []);

  async function cerrarSesion() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (estadoAcceso === "verificando") {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <p style={{ color: "var(--navy-medio)" }}>Verificando acceso…</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          flex: "0 0 240px",
          background: "var(--navy)",
          color: "white",
          padding: "1.5rem 1rem",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <strong
          style={{
            fontFamily: "var(--font-titulo)",
            fontSize: "1.25rem",
            display: "block",
            marginBottom: "2rem",
          }}
        >
          Kairos
        </strong>
        <nav style={{ flex: 1 }}>
          {NAV_ITEMS.map((item) => {
            const activo = item.disponible && item.href !== "/" && rutaActual.startsWith(item.href);
            return (
              <a
                key={item.label}
                href={item.disponible ? item.href : undefined}
                aria-disabled={!item.disponible}
                style={{
                  display: "block",
                  padding: "0.6rem 0.75rem",
                  borderRadius: "8px",
                  marginBottom: "0.25rem",
                  color: item.disponible ? "white" : "rgba(255,255,255,0.35)",
                  background: activo ? "var(--teal)" : "transparent",
                  textDecoration: "none",
                  cursor: item.disponible ? "pointer" : "default",
                  pointerEvents: item.disponible ? "auto" : "none",
                }}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: "1rem" }}>
          {correoUsuario && (
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.8rem", color: "rgba(255,255,255,0.6)" }}>
              {correoUsuario}
            </p>
          )}
          <button
            type="button"
            onClick={cerrarSesion}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.35)",
              color: "white",
              width: "100%",
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, background: "var(--superficie)" }}>{children}</main>
    </div>
  );
}

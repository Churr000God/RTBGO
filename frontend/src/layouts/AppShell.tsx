import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  Building2,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Clock,
  LayoutGrid,
  LogOut,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

import { supabase } from "../lib/supabaseClient";
import { registrarErrorAuth } from "../lib/erroresAuth";
import { consultarSesion } from "../lib/sesion";

type EstadoAcceso = "verificando" | "permitido";

type NavItem = { label: string; href: string; disponible: boolean };

// `disponible` (a nivel de grupo y de item) es el punto de enganche del gate de permisos
// futuro (SCJ-PRO-05): el día que exista `puesto_permiso`, este valor pasa a derivarse del
// set de permisos del caller en vez de estar fijo aquí — por eso la estructura es data-driven
// (este arreglo) y no JSX hardcodeado por pestaña.
type NavGroup = { label: string; icono: LucideIcon; disponible: boolean; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  { label: "Panel", icono: LayoutGrid, disponible: false, items: [] },
  {
    label: "Personas y Usuarios",
    icono: Users,
    disponible: true,
    items: [
      { label: "Directorio", href: "/personas", disponible: true },
      { label: "Alta de persona", href: "/personas/nueva", disponible: true },
      { label: "Alta de usuario", href: "/usuarios/nuevo", disponible: true },
    ],
  },
  {
    label: "Estructura organizacional",
    icono: Building2,
    disponible: true,
    items: [
      { label: "Áreas", href: "/estructura/areas", disponible: true },
      { label: "Departamentos", href: "/estructura/departamentos", disponible: true },
      { label: "Puestos", href: "/estructura/puestos", disponible: false },
      { label: "Permisos", href: "/estructura/permisos", disponible: false },
    ],
  },
  { label: "Marcas", icono: Clock, disponible: false, items: [] },
  { label: "Jornadas", icono: CalendarClock, disponible: false, items: [] },
  { label: "Autorizaciones", icono: ShieldCheck, disponible: false, items: [] },
  { label: "Reportes", icono: BarChart3, disponible: false, items: [] },
  { label: "Configuración", icono: Settings, disponible: false, items: [] },
];

type Props = { children: ReactNode };

export function AppShell({ children }: Props) {
  const rutaActual = typeof window !== "undefined" ? window.location.pathname : "";
  const [correoUsuario, setCorreoUsuario] = useState<string | null>(null);
  const [estadoAcceso, setEstadoAcceso] = useState<EstadoAcceso>("verificando");
  const [gruposAbiertos, setGruposAbiertos] = useState<Set<string>>(
    () =>
      new Set(
        NAV_GROUPS.filter((grupo) =>
          grupo.items.some((item) => item.disponible && rutaActual.startsWith(item.href)),
        ).map((grupo) => grupo.label),
      ),
  );

  function alternarGrupo(label: string) {
    setGruposAbiertos((anterior) => {
      const siguiente = new Set(anterior);
      if (siguiente.has(label)) {
        siguiente.delete(label);
      } else {
        siguiente.add(label);
      }
      return siguiente;
    });
  }

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
    // consultarSesion() deduplica la petición a nivel de módulo — con StrictMode este efecto
    // se monta dos veces en dev, y sin deduplicar cada montaje disparaba su propio
    // GET /api/sesion; por timing entre apiFetch/getSession() y el doble montaje, uno de los
    // dos podía salir sin token válido y entrar en fail-open de más, no por una falla real.
    let vivo = true;

    consultarSesion()
      .then(async (sesion) => {
        if (!vivo) return;
        if (!sesion.acceso_permitido) {
          // Una vez confirmado que NO hay acceso, el redirect tiene que pasar sí o sí — que
          // signOut() falle (p. ej. un hiccup de red al llamar a GoTrue, después de que ya
          // limpió la sesión local) no puede tirarnos al .catch() de más abajo y hacer
          // fail-open: eso dejaría a la persona deslogueada en silencio y sin redirigir,
          // viendo la ruta interna rota. El signOut ya limpia localStorage aunque la llamada
          // de red falle, así que igual conviene mandarla a la pantalla de bloqueo.
          try {
            await supabase.auth.signOut();
          } catch (errorSignOut) {
            registrarErrorAuth("AppShell.signOut", errorSignOut);
          }
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
          flex: "0 0 260px",
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
            fontSize: "1.35rem",
            display: "block",
            marginBottom: "2rem",
            padding: "0 0.5rem",
          }}
        >
          Kairos
        </strong>
        <nav style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {NAV_GROUPS.map((grupo) => {
            const Icono = grupo.icono;

            if (grupo.items.length === 0) {
              return (
                <div key={grupo.label} className="nav-item-plano" aria-disabled={!grupo.disponible}>
                  <Icono size={18} aria-hidden="true" />
                  {grupo.label}
                </div>
              );
            }

            const abierto = gruposAbiertos.has(grupo.label);
            const grupoActivo = grupo.items.some(
              (item) => item.disponible && rutaActual.startsWith(item.href),
            );
            const ChevronIcono = abierto ? ChevronDown : ChevronRight;

            return (
              <div className="nav-grupo" key={grupo.label}>
                <button
                  type="button"
                  className={`nav-grupo-titulo${grupoActivo ? " nav-grupo-titulo--activo" : ""}`}
                  onClick={() => alternarGrupo(grupo.label)}
                  aria-expanded={abierto}
                >
                  <Icono size={18} aria-hidden="true" />
                  {grupo.label}
                  <ChevronIcono size={16} aria-hidden="true" />
                </button>
                {abierto && (
                  <div className="nav-subitems">
                    {grupo.items.map((item) => {
                      if (!item.disponible) {
                        return (
                          <div
                            key={item.label}
                            className="nav-subitem nav-subitem--atenuado"
                            aria-disabled="true"
                          >
                            {item.label}
                            <span className="etiqueta-proximamente">Próximamente</span>
                          </div>
                        );
                      }
                      const activo = rutaActual.startsWith(item.href);
                      return (
                        <a
                          key={item.href}
                          href={item.href}
                          className={`nav-subitem${activo ? " nav-subitem--activo" : ""}`}
                        >
                          {item.label}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: "1rem" }}>
          {correoUsuario && (
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.8rem", color: "rgba(255,255,255,0.6)" }}>
              {correoUsuario}
            </p>
          )}
          <button type="button" onClick={cerrarSesion} className="boton-cerrar-sesion">
            <LogOut size={16} aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, background: "var(--superficie)" }}>{children}</main>
    </div>
  );
}

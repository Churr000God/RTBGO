import type { ReactNode } from "react";

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

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          flex: "0 0 240px",
          background: "var(--navy)",
          color: "white",
          padding: "1.5rem 1rem",
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
        <nav>
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
      </aside>
      <main style={{ flex: 1, background: "var(--superficie)" }}>{children}</main>
    </div>
  );
}

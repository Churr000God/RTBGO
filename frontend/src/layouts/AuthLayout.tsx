import type { ReactNode } from "react";

type Props = {
  titulo: string;
  bajada: string;
  children: ReactNode;
};

export function AuthLayout({ titulo, bajada, children }: Props) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          flex: "0 0 42%",
          background:
            "linear-gradient(160deg, var(--navy) 0%, var(--teal) 60%, var(--teal-claro) 100%)",
          color: "white",
          padding: "3rem",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <strong style={{ fontFamily: "var(--font-titulo)", fontSize: "1.5rem" }}>Kairos</strong>
        <div>
          <h1 style={{ fontFamily: "var(--font-titulo)", fontSize: "2.5rem" }}>{titulo}</h1>
          <p>{bajada}</p>
        </div>
        <small>Distribuidora Central, S.A. de C.V. · v1.0</small>
      </aside>
      <main style={{ flex: 1, display: "grid", placeItems: "center", background: "white" }}>
        <div
          style={{
            background: "var(--superficie)",
            borderRadius: "var(--radio-tarjeta)",
            boxShadow: "var(--sombra-tarjeta)",
            padding: "2.5rem",
            width: "min(420px, 90%)",
          }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}

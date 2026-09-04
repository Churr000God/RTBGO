import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "../lib/apiClient";
import { supabase } from "../lib/supabaseClient";
import { AppShell } from "./AppShell";

vi.mock("../lib/apiClient", () => ({ apiFetch: vi.fn() }));
vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { email: "mariana@example.com" } } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

describe("AppShell", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(supabase.auth.signOut).mockClear();
  });

  it("con acceso permitido, muestra el shell y el contenido sin redirigir", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ acceso_permitido: true, motivo_bloqueo: null }), { status: 200 })
    );

    render(
      <AppShell>
        <p>Contenido protegido</p>
      </AppShell>
    );

    await waitFor(() => expect(screen.getByText("Contenido protegido")).toBeInTheDocument());
    expect(screen.getByText("Cerrar sesión")).toBeInTheDocument();
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });

  it("con acceso no permitido, cierra sesión y redirige a /cuenta-suspendida con el motivo", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ acceso_permitido: false, motivo_bloqueo: "suspension" }), {
        status: 200,
      })
    );

    render(
      <AppShell>
        <p>Contenido protegido</p>
      </AppShell>
    );

    await waitFor(() => expect(supabase.auth.signOut).toHaveBeenCalled());
    expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
  });

  it("si /api/sesion falla, no bloquea: muestra el shell igual (fail-open)", async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error("network down"));

    render(
      <AppShell>
        <p>Contenido protegido</p>
      </AppShell>
    );

    await waitFor(() => expect(screen.getByText("Contenido protegido")).toBeInTheDocument());
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });

  it("si /api/sesion responde con error HTTP, tampoco bloquea (fail-open)", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 500 }));

    render(
      <AppShell>
        <p>Contenido protegido</p>
      </AppShell>
    );

    await waitFor(() => expect(screen.getByText("Contenido protegido")).toBeInTheDocument());
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });
});

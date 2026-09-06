import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "../lib/apiClient";
import { BandejaAusenciasPage } from "./BandejaAusenciasPage";

vi.mock("../lib/apiClient", () => ({ apiFetch: vi.fn() }));
vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

const AUSENCIA = {
  id: 1,
  persona_id: "persona-1",
  persona_nombre: "Persona Ficticia",
  tipo_de_ausencia: "falta",
  fecha_inicio: "2026-09-06",
  fecha_fin: "2026-09-06",
  estado_autorizacion: "pendiente",
};

function mockApiFetch(opciones: { pendientes?: Response; resolver?: Response }) {
  vi.mocked(apiFetch).mockImplementation((path: string, init?: RequestInit) => {
    if (path === "/api/sesion") {
      return Promise.resolve(
        new Response(JSON.stringify({ acceso_permitido: true, motivo_bloqueo: null })),
      );
    }
    if (path === "/api/ausencias/pendientes") {
      return Promise.resolve(opciones.pendientes ?? new Response(JSON.stringify([AUSENCIA])));
    }
    if (path === "/api/ausencias/1/resolver" && init?.method === "POST") {
      return Promise.resolve(
        opciones.resolver ??
          new Response(
            JSON.stringify({ ...AUSENCIA, estado_autorizacion: "autorizada" }),
            { status: 200 },
          ),
      );
    }
    return Promise.reject(new Error(`ruta no mockeada: ${path}`));
  });
}

describe("BandejaAusenciasPage", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it("lista las ausencias pendientes devueltas por el servidor", async () => {
    mockApiFetch({});

    render(<BandejaAusenciasPage />);

    await waitFor(() => expect(screen.getByText("Persona Ficticia")).toBeInTheDocument());
    expect(screen.getByText("Falta sin resolver")).toBeInTheDocument();
  });

  it("muestra estado vacío cuando no hay ausencias pendientes", async () => {
    mockApiFetch({ pendientes: new Response(JSON.stringify([])) });

    render(<BandejaAusenciasPage />);

    await waitFor(() =>
      expect(screen.getByText(/no hay ausencias pendientes de resolver/i)).toBeInTheDocument(),
    );
  });

  it("aprueba con un tipo elegido y recarga el listado", async () => {
    mockApiFetch({});

    render(<BandejaAusenciasPage />);
    await waitFor(() => expect(screen.getByText("Persona Ficticia")).toBeInTheDocument());

    await userEvent.selectOptions(
      screen.getByLabelText(/reclasificar a/i),
      "permiso_con_goce",
    );
    await userEvent.click(screen.getByRole("button", { name: /^aprobar$/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/ausencias/1/resolver",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const llamada = vi
      .mocked(apiFetch)
      .mock.calls.find(([path]) => path === "/api/ausencias/1/resolver")!;
    const cuerpo = JSON.parse(llamada[1]!.body as string);
    expect(cuerpo.decision).toBe("autorizada");
    expect(cuerpo.tipo_de_ausencia).toBe("permiso_con_goce");

    // recarga: un segundo GET a /api/ausencias/pendientes después del POST
    const llamadasListado = vi
      .mocked(apiFetch)
      .mock.calls.filter(([path]) => path === "/api/ausencias/pendientes");
    expect(llamadasListado.length).toBeGreaterThanOrEqual(2);
  });

  it("el botón Aprobar queda deshabilitado sin tipo elegido", async () => {
    mockApiFetch({});

    render(<BandejaAusenciasPage />);
    await waitFor(() => expect(screen.getByText("Persona Ficticia")).toBeInTheDocument());

    expect(screen.getByRole("button", { name: /^aprobar$/i })).toBeDisabled();
  });

  it("rechaza sin exigir tipo y muestra el error real si el backend ya la resolvió (409)", async () => {
    mockApiFetch({
      resolver: new Response(
        JSON.stringify({ detail: "Esta ausencia ya fue resuelta -- alguien más se te adelantó." }),
        { status: 409 },
      ),
    });

    render(<BandejaAusenciasPage />);
    await waitFor(() => expect(screen.getByText("Persona Ficticia")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /rechazar/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/ausencias/1/resolver",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const llamada = vi
      .mocked(apiFetch)
      .mock.calls.find(([path]) => path === "/api/ausencias/1/resolver")!;
    const cuerpo = JSON.parse(llamada[1]!.body as string);
    expect(cuerpo.decision).toBe("rechazada");

    await waitFor(() =>
      expect(screen.getByText(/alguien más se te adelantó/i)).toBeInTheDocument(),
    );
  });
});

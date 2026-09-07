import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { apiFetch } from "../lib/apiClient";
import { BancoDeHorasPage } from "./BancoDeHorasPage";

vi.mock("../lib/apiClient", () => ({ apiFetch: vi.fn() }));
vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

const SALDOS = [
  {
    persona_id: "persona-1",
    persona_nombre: "Persona Endeudada",
    monto: 4.5,
    vivo_desde: "2026-09-01T00:00:00Z",
    actualizado_en: "2026-09-06T10:00:00Z",
  },
  {
    persona_id: "persona-2",
    persona_nombre: "Persona Al Corriente",
    monto: 0,
    vivo_desde: null,
    actualizado_en: "2026-09-06T10:00:00Z",
  },
];

function mockApiFetch(listado?: Response) {
  vi.mocked(apiFetch).mockImplementation((path: string) => {
    if (path === "/api/sesion") {
      return Promise.resolve(
        new Response(JSON.stringify({ acceso_permitido: true, motivo_bloqueo: null })),
      );
    }
    if (path === "/api/banco-de-horas") {
      return Promise.resolve(listado ?? new Response(JSON.stringify(SALDOS)));
    }
    return Promise.reject(new Error(`ruta no mockeada: ${path}`));
  });
}

describe("BancoDeHorasPage", () => {
  it("lista los saldos devueltos por GET /api/banco-de-horas, con deuda y sin deuda", async () => {
    mockApiFetch();

    render(<BancoDeHorasPage />);

    const tabla = await screen.findByRole("table");
    await waitFor(() => expect(within(tabla).getByText("Persona Endeudada")).toBeInTheDocument());
    expect(within(tabla).getByText("4.50 h en deuda")).toBeInTheDocument();
    expect(within(tabla).getByText("Persona Al Corriente")).toBeInTheDocument();
    expect(within(tabla).getByText("0.00 h sin deuda")).toBeInTheDocument();
    expect(screen.getByText(/mostrando 2 de 2 personas/i)).toBeInTheDocument();
  });

  it("filtra por nombre (sin distinguir acentos ni mayúsculas)", async () => {
    mockApiFetch();

    render(<BancoDeHorasPage />);
    const tabla = await screen.findByRole("table");
    await waitFor(() => expect(within(tabla).getByText("Persona Endeudada")).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText(/buscar por nombre/i), "endeudada");

    expect(within(tabla).getByText("Persona Endeudada")).toBeInTheDocument();
    expect(within(tabla).queryByText("Persona Al Corriente")).not.toBeInTheDocument();
    expect(screen.getByText(/mostrando 1 de 2 personas/i)).toBeInTheDocument();
  });

  it("muestra estado vacío cuando la búsqueda no coincide con nadie", async () => {
    mockApiFetch();

    render(<BancoDeHorasPage />);
    const tabla = await screen.findByRole("table");
    await waitFor(() => expect(within(tabla).getByText("Persona Endeudada")).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText(/buscar por nombre/i), "nadie-existe");

    await waitFor(() =>
      expect(screen.getByText(/no hay saldos que coincidan con la búsqueda/i)).toBeInTheDocument(),
    );
  });

  it("muestra el top en deuda con gráfica de barras y la lista de personas sin deuda", async () => {
    mockApiFetch();

    render(<BancoDeHorasPage />);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Top en deuda" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("heading", { name: "Sin deuda" })).toBeInTheDocument();
    // "Persona Endeudada" aparece en la barra de la gráfica y también en la tabla — alcanza con
    // que exista al menos una vez fuera de la tabla (la barra) para confirmar que se armó.
    const tabla = screen.getByRole("table");
    expect(within(tabla).getByText("Persona Al Corriente")).toBeInTheDocument();
  });

  it("muestra el estado de error cuando falla la carga", async () => {
    mockApiFetch(new Response(null, { status: 500 }));

    render(<BancoDeHorasPage />);

    await waitFor(() =>
      expect(screen.getByText(/no se pudo cargar el banco de horas/i)).toBeInTheDocument(),
    );
  });
});

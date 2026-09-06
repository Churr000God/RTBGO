import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { apiFetch } from "../lib/apiClient";
import { ColaExcepcionesPage } from "./ColaExcepcionesPage";

vi.mock("../lib/apiClient", () => ({ apiFetch: vi.fn() }));
vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

const EXCEPCIONES = [
  {
    id: 1,
    marca_id: 10,
    dia_id: null,
    motivo_revision: "fuera_de_horario",
    estado: "pendiente",
    creado_en: "2026-09-06T12:00:00Z",
    persona_nombre: "Persona Ficticia",
    momento_dispositivo: "2026-09-06T12:00:00Z",
  },
  {
    id: 2,
    marca_id: null,
    dia_id: 5,
    motivo_revision: "dia_sin_marca",
    estado: "pendiente",
    creado_en: "2026-09-05T08:00:00Z",
    persona_nombre: null,
    momento_dispositivo: null,
  },
];

function mockApiFetch(listado?: Response) {
  vi.mocked(apiFetch).mockImplementation((path: string) => {
    if (path === "/api/sesion") {
      return Promise.resolve(
        new Response(JSON.stringify({ acceso_permitido: true, motivo_bloqueo: null })),
      );
    }
    if (path === "/api/excepciones") {
      return Promise.resolve(listado ?? new Response(JSON.stringify(EXCEPCIONES)));
    }
    return Promise.reject(new Error(`ruta no mockeada: ${path}`));
  });
}

describe("ColaExcepcionesPage", () => {
  it("lista sólo las excepciones con marca_id (las de dia_id las resuelve la bandeja de ausencias)", async () => {
    mockApiFetch();

    render(<ColaExcepcionesPage />);

    await waitFor(() => expect(screen.getByText("Persona Ficticia")).toBeInTheDocument());
    expect(screen.getByText("fuera_de_horario")).toBeInTheDocument();
    expect(screen.queryByText("dia_sin_marca")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /corregir/i })).toHaveAttribute(
      "href",
      "/tiempo/excepciones/1/corregir",
    );
  });

  it("muestra estado vacío cuando no hay excepciones pendientes", async () => {
    mockApiFetch(new Response(JSON.stringify([])));

    render(<ColaExcepcionesPage />);

    await waitFor(() =>
      expect(screen.getByText(/no hay excepciones de marca pendientes/i)).toBeInTheDocument(),
    );
  });

  it("muestra el estado de error cuando falla la carga", async () => {
    mockApiFetch(new Response(null, { status: 500 }));

    render(<ColaExcepcionesPage />);

    await waitFor(() =>
      expect(screen.getByText(/no se pudo cargar la cola de excepciones/i)).toBeInTheDocument(),
    );
  });
});

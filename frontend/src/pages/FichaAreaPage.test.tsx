import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { apiFetch } from "../lib/apiClient";
import { FichaAreaPage } from "./FichaAreaPage";

vi.mock("../lib/apiClient", () => ({ apiFetch: vi.fn() }));
vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

const AREA = {
  id: "33333333-3333-3333-3333-333333333333",
  nombre_area: "Comercial",
  activo: true,
  creado_en: "2026-08-31T00:00:00+00:00",
  actualizado_en: "2026-08-31T00:00:00+00:00",
};

function mockApiFetch(area = AREA) {
  vi.mocked(apiFetch).mockImplementation((path: string) => {
    if (path === "/api/sesion") {
      return Promise.resolve(
        new Response(JSON.stringify({ acceso_permitido: true, motivo_bloqueo: null }))
      );
    }
    return Promise.resolve(new Response(JSON.stringify(area)));
  });
}

function renderPagina() {
  render(
    <MemoryRouter initialEntries={[`/estructura/areas/${AREA.id}`]}>
      <Routes>
        <Route path="/estructura/areas/:id" element={<FichaAreaPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("FichaAreaPage", () => {
  it("muestra el nombre y el estado del área", async () => {
    mockApiFetch();
    renderPagina();

    await waitFor(() => expect(screen.getAllByText("Comercial").length).toBeGreaterThan(0));
    expect(screen.getByText("Activo")).toBeInTheDocument();
  });

  it("renombra el área vía PATCH /api/areas/:id", async () => {
    let renombrada = false;
    vi.mocked(apiFetch).mockImplementation((path: string, opciones?: RequestInit) => {
      if (path === "/api/sesion") {
        return Promise.resolve(
          new Response(JSON.stringify({ acceso_permitido: true, motivo_bloqueo: null }))
        );
      }
      if (path === `/api/areas/${AREA.id}` && opciones?.method === "PATCH") {
        renombrada = true;
        return Promise.resolve(
          new Response(JSON.stringify({ ...AREA, nombre_area: "Comercial y Marketing" }))
        );
      }
      return Promise.resolve(new Response(JSON.stringify(AREA)));
    });

    renderPagina();
    await waitFor(() => expect(screen.getAllByText("Comercial").length).toBeGreaterThan(0));

    const campoNombre = screen.getByLabelText(/^nombre$/i);
    await userEvent.clear(campoNombre);
    await userEvent.type(campoNombre, "Comercial y Marketing");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(renombrada).toBe(true));
    await waitFor(() =>
      expect(screen.getAllByText("Comercial y Marketing").length).toBeGreaterThan(0)
    );
  });

  it("muestra error de nombre duplicado al renombrar (409)", async () => {
    vi.mocked(apiFetch).mockImplementation((path: string, opciones?: RequestInit) => {
      if (path === "/api/sesion") {
        return Promise.resolve(
          new Response(JSON.stringify({ acceso_permitido: true, motivo_bloqueo: null }))
        );
      }
      if (path === `/api/areas/${AREA.id}` && opciones?.method === "PATCH") {
        return Promise.resolve(new Response(null, { status: 409 }));
      }
      return Promise.resolve(new Response(JSON.stringify(AREA)));
    });

    renderPagina();
    await waitFor(() => expect(screen.getAllByText("Comercial").length).toBeGreaterThan(0));
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() =>
      expect(screen.getByText(/ya existe un área con ese nombre/i)).toBeInTheDocument()
    );
  });

  it("desactiva el área vía PATCH /api/areas/:id/estado", async () => {
    vi.mocked(apiFetch).mockImplementation((path: string, opciones?: RequestInit) => {
      if (path === "/api/sesion") {
        return Promise.resolve(
          new Response(JSON.stringify({ acceso_permitido: true, motivo_bloqueo: null }))
        );
      }
      if (path === `/api/areas/${AREA.id}/estado` && opciones?.method === "PATCH") {
        return Promise.resolve(new Response(JSON.stringify({ ...AREA, activo: false })));
      }
      return Promise.resolve(new Response(JSON.stringify(AREA)));
    });

    renderPagina();
    await waitFor(() => expect(screen.getAllByText("Comercial").length).toBeGreaterThan(0));
    await userEvent.click(screen.getByRole("button", { name: /desactivar área/i }));

    await waitFor(() => expect(screen.getByText("Inactivo")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /reactivar área/i })).toBeInTheDocument();
  });

  it("reactiva un área inactiva vía PATCH /api/areas/:id/estado", async () => {
    vi.mocked(apiFetch).mockImplementation((path: string, opciones?: RequestInit) => {
      if (path === "/api/sesion") {
        return Promise.resolve(
          new Response(JSON.stringify({ acceso_permitido: true, motivo_bloqueo: null }))
        );
      }
      if (path === `/api/areas/${AREA.id}/estado` && opciones?.method === "PATCH") {
        return Promise.resolve(new Response(JSON.stringify({ ...AREA, activo: true })));
      }
      return Promise.resolve(new Response(JSON.stringify({ ...AREA, activo: false })));
    });

    renderPagina();
    await waitFor(() => expect(screen.getByText("Inactivo")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /reactivar área/i }));

    await waitFor(() => expect(screen.getByText("Activo")).toBeInTheDocument());
  });

  it("si GET /api/areas/:id falla, muestra error con reintentar", async () => {
    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path === "/api/sesion") {
        return Promise.resolve(
          new Response(JSON.stringify({ acceso_permitido: true, motivo_bloqueo: null }))
        );
      }
      return Promise.resolve(new Response(null, { status: 500 }));
    });

    renderPagina();

    await waitFor(() =>
      expect(screen.getByText(/no se pudo cargar esta área/i)).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();
  });
});

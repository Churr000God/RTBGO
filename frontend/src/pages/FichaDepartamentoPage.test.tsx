import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { apiFetch } from "../lib/apiClient";
import { FichaDepartamentoPage } from "./FichaDepartamentoPage";

vi.mock("../lib/apiClient", () => ({ apiFetch: vi.fn() }));
vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

const AREA = { id: "area-1", nombre_area: "Comercial" };

const DEPARTAMENTO = {
  id: "55555555-5555-5555-5555-555555555555",
  area_id: AREA.id,
  nombre_departamento: "Ventas",
  activo: true,
  creado_en: "2026-08-31T00:00:00+00:00",
  actualizado_en: "2026-08-31T00:00:00+00:00",
};

function mockApiFetch(departamento = DEPARTAMENTO, area: Record<string, unknown> | null = AREA) {
  vi.mocked(apiFetch).mockImplementation((path: string) => {
    if (path === "/api/sesion") {
      return Promise.resolve(
        new Response(JSON.stringify({ acceso_permitido: true, motivo_bloqueo: null }))
      );
    }
    if (path === `/api/areas/${departamento.area_id}`) {
      return Promise.resolve(area ? new Response(JSON.stringify(area)) : new Response(null, { status: 404 }));
    }
    return Promise.resolve(new Response(JSON.stringify(departamento)));
  });
}

function renderPagina() {
  render(
    <MemoryRouter initialEntries={[`/estructura/departamentos/${DEPARTAMENTO.id}`]}>
      <Routes>
        <Route path="/estructura/departamentos/:id" element={<FichaDepartamentoPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("FichaDepartamentoPage", () => {
  it("muestra el nombre, estado y el nombre del área padre", async () => {
    mockApiFetch();
    renderPagina();

    await waitFor(() => expect(screen.getAllByText("Ventas").length).toBeGreaterThan(0));
    expect(screen.getByText("Activo")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Comercial")).toBeInTheDocument());
  });

  it("renombra el departamento vía PATCH /api/departamentos/:id", async () => {
    let renombrado = false;
    vi.mocked(apiFetch).mockImplementation((path: string, opciones?: RequestInit) => {
      if (path === "/api/sesion") {
        return Promise.resolve(
          new Response(JSON.stringify({ acceso_permitido: true, motivo_bloqueo: null }))
        );
      }
      if (path === `/api/areas/${AREA.id}`) {
        return Promise.resolve(new Response(JSON.stringify(AREA)));
      }
      if (path === `/api/departamentos/${DEPARTAMENTO.id}` && opciones?.method === "PATCH") {
        renombrado = true;
        return Promise.resolve(
          new Response(JSON.stringify({ ...DEPARTAMENTO, nombre_departamento: "Ventas Nacionales" }))
        );
      }
      return Promise.resolve(new Response(JSON.stringify(DEPARTAMENTO)));
    });

    renderPagina();
    await waitFor(() => expect(screen.getAllByText("Ventas").length).toBeGreaterThan(0));

    const campoNombre = screen.getByLabelText(/^nombre$/i);
    await userEvent.clear(campoNombre);
    await userEvent.type(campoNombre, "Ventas Nacionales");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(renombrado).toBe(true));
    await waitFor(() =>
      expect(screen.getAllByText("Ventas Nacionales").length).toBeGreaterThan(0)
    );
  });

  it("desactiva el departamento vía PATCH /api/departamentos/:id/estado", async () => {
    vi.mocked(apiFetch).mockImplementation((path: string, opciones?: RequestInit) => {
      if (path === "/api/sesion") {
        return Promise.resolve(
          new Response(JSON.stringify({ acceso_permitido: true, motivo_bloqueo: null }))
        );
      }
      if (path === `/api/areas/${AREA.id}`) {
        return Promise.resolve(new Response(JSON.stringify(AREA)));
      }
      if (path === `/api/departamentos/${DEPARTAMENTO.id}/estado` && opciones?.method === "PATCH") {
        return Promise.resolve(new Response(JSON.stringify({ ...DEPARTAMENTO, activo: false })));
      }
      return Promise.resolve(new Response(JSON.stringify(DEPARTAMENTO)));
    });

    renderPagina();
    await waitFor(() => expect(screen.getAllByText("Ventas").length).toBeGreaterThan(0));
    await userEvent.click(screen.getByRole("button", { name: /desactivar departamento/i }));

    await waitFor(() => expect(screen.getByText("Inactivo")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /reactivar departamento/i })).toBeInTheDocument();
  });

  it("reactiva un departamento inactivo vía PATCH /api/departamentos/:id/estado", async () => {
    vi.mocked(apiFetch).mockImplementation((path: string, opciones?: RequestInit) => {
      if (path === "/api/sesion") {
        return Promise.resolve(
          new Response(JSON.stringify({ acceso_permitido: true, motivo_bloqueo: null }))
        );
      }
      if (path === `/api/areas/${AREA.id}`) {
        return Promise.resolve(new Response(JSON.stringify(AREA)));
      }
      if (path === `/api/departamentos/${DEPARTAMENTO.id}/estado` && opciones?.method === "PATCH") {
        return Promise.resolve(new Response(JSON.stringify({ ...DEPARTAMENTO, activo: true })));
      }
      return Promise.resolve(new Response(JSON.stringify({ ...DEPARTAMENTO, activo: false })));
    });

    renderPagina();
    await waitFor(() => expect(screen.getByText("Inactivo")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /reactivar departamento/i }));

    await waitFor(() => expect(screen.getByText("Activo")).toBeInTheDocument());
  });

  it("si GET /api/departamentos/:id falla, muestra error con reintentar", async () => {
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
      expect(screen.getByText(/no se pudo cargar este departamento/i)).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { apiFetch } from "../lib/apiClient";
import { FichaPuestoPage } from "./FichaPuestoPage";

vi.mock("../lib/apiClient", () => ({ apiFetch: vi.fn() }));
vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

const DEPARTAMENTO = { id: "dep-1", nombre_departamento: "Ventas" };
const SUPERIOR = { id: "puesto-superior", nombre_puesto: "Director Comercial" };

const PUESTO = {
  id: "77777777-7777-7777-7777-777777777777",
  departamento_id: DEPARTAMENTO.id,
  nombre_puesto: "Ejecutivo de Ventas",
  nivel: "operativo",
  plazas_totales: 5,
  reporta_a_id: SUPERIOR.id,
  activo: true,
  creado_en: "2026-08-31T00:00:00+00:00",
  actualizado_en: "2026-08-31T00:00:00+00:00",
};

function mockApiFetch(overrides: {
  puesto?: Record<string, unknown>;
  departamento?: Record<string, unknown> | null;
  superior?: Record<string, unknown> | null;
  patch?: (path: string, init: RequestInit) => Response | undefined;
} = {}) {
  const puesto = overrides.puesto ?? PUESTO;
  const departamento = overrides.departamento === undefined ? DEPARTAMENTO : overrides.departamento;
  const superior = overrides.superior === undefined ? SUPERIOR : overrides.superior;

  vi.mocked(apiFetch).mockImplementation((path: string, init?: RequestInit) => {
    if (path === "/api/sesion") {
      return Promise.resolve(
        new Response(JSON.stringify({ acceso_permitido: true, motivo_bloqueo: null }))
      );
    }
    if (overrides.patch && init?.method === "PATCH") {
      const respuesta = overrides.patch(path, init);
      if (respuesta) return Promise.resolve(respuesta);
    }
    if (path === `/api/departamentos/${(puesto as typeof PUESTO).departamento_id}`) {
      return Promise.resolve(
        departamento ? new Response(JSON.stringify(departamento)) : new Response(null, { status: 404 })
      );
    }
    if (path === `/api/puestos/${(puesto as typeof PUESTO).reporta_a_id}`) {
      return Promise.resolve(
        superior ? new Response(JSON.stringify(superior)) : new Response(null, { status: 404 })
      );
    }
    return Promise.resolve(new Response(JSON.stringify(puesto)));
  });
}

function renderPagina() {
  render(
    <MemoryRouter initialEntries={[`/estructura/puestos/${PUESTO.id}`]}>
      <Routes>
        <Route path="/estructura/puestos/:id" element={<FichaPuestoPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("FichaPuestoPage", () => {
  it("muestra nombre, estado, nivel, plazas, departamento y puesto superior", async () => {
    mockApiFetch();
    renderPagina();

    await waitFor(() => expect(screen.getAllByText("Ejecutivo de Ventas").length).toBeGreaterThan(0));
    expect(screen.getByText("Activo")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Ventas")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("Director Comercial")).toBeInTheDocument());
  });

  it("muestra '— (puesto tope)' cuando no hay reporta_a_id", async () => {
    mockApiFetch({ puesto: { ...PUESTO, reporta_a_id: null } });
    renderPagina();

    await waitFor(() => expect(screen.getAllByText("Ejecutivo de Ventas").length).toBeGreaterThan(0));
    expect(screen.getByText("— (puesto tope)")).toBeInTheDocument();
  });

  it("renombra/cambia nivel y plazas vía PATCH /api/puestos/:id", async () => {
    let cuerpoEnviado: Record<string, unknown> | null = null;
    mockApiFetch({
      patch: (path, init) => {
        if (path !== `/api/puestos/${PUESTO.id}`) return undefined;
        cuerpoEnviado = JSON.parse(init.body as string);
        return new Response(
          JSON.stringify({ ...PUESTO, nombre_puesto: "Gerente de Ventas", nivel: "gerencia", plazas_totales: 1 })
        );
      },
    });
    renderPagina();
    await waitFor(() => expect(screen.getAllByText("Ejecutivo de Ventas").length).toBeGreaterThan(0));

    const campoNombre = screen.getByLabelText(/^nombre$/i);
    await userEvent.clear(campoNombre);
    await userEvent.type(campoNombre, "Gerente de Ventas");
    await userEvent.selectOptions(screen.getByLabelText(/^nivel$/i), "gerencia");
    const plazas = screen.getByLabelText(/plazas totales/i);
    await userEvent.clear(plazas);
    await userEvent.type(plazas, "1");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(cuerpoEnviado).not.toBeNull());
    expect(cuerpoEnviado).toMatchObject({
      nombre_puesto: "Gerente de Ventas",
      nivel: "gerencia",
      plazas_totales: 1,
    });
    await waitFor(() => expect(screen.getAllByText("Gerente de Ventas").length).toBeGreaterThan(0));
  });

  it("bloquea la desactivación por subordinados activos y muestra el detail real del backend", async () => {
    mockApiFetch({
      patch: (path) => {
        if (path !== `/api/puestos/${PUESTO.id}/estado`) return undefined;
        return new Response(
          JSON.stringify({ detail: "No se puede desactivar: tiene puestos subordinados activos." }),
          { status: 422 }
        );
      },
    });
    renderPagina();
    await waitFor(() => expect(screen.getAllByText("Ejecutivo de Ventas").length).toBeGreaterThan(0));

    await userEvent.click(screen.getByRole("button", { name: /desactivar puesto/i }));

    await waitFor(() =>
      expect(
        screen.getByText("No se puede desactivar: tiene puestos subordinados activos.")
      ).toBeInTheDocument()
    );
    // sigue activo: el estado no debe haber cambiado
    expect(screen.getByText("Activo")).toBeInTheDocument();
  });

  it("desactiva el puesto cuando no hay subordinados activos", async () => {
    mockApiFetch({
      patch: (path) => {
        if (path !== `/api/puestos/${PUESTO.id}/estado`) return undefined;
        return new Response(JSON.stringify({ ...PUESTO, activo: false }));
      },
    });
    renderPagina();
    await waitFor(() => expect(screen.getAllByText("Ejecutivo de Ventas").length).toBeGreaterThan(0));

    await userEvent.click(screen.getByRole("button", { name: /desactivar puesto/i }));

    await waitFor(() => expect(screen.getByText("Inactivo")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /reactivar puesto/i })).toBeInTheDocument();
  });

  it("bloquea la reactivación cuando el departamento o el superior están inactivos, con el detail real", async () => {
    mockApiFetch({
      puesto: { ...PUESTO, activo: false },
      patch: (path) => {
        if (path !== `/api/puestos/${PUESTO.id}/estado`) return undefined;
        return new Response(
          JSON.stringify({
            detail: "No se puede reactivar: el departamento o el puesto superior no están activos.",
          }),
          { status: 422 }
        );
      },
    });
    renderPagina();
    await waitFor(() => expect(screen.getByText("Inactivo")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /reactivar puesto/i }));

    await waitFor(() =>
      expect(
        screen.getByText(
          "No se puede reactivar: el departamento o el puesto superior no están activos."
        )
      ).toBeInTheDocument()
    );
    expect(screen.getByText("Inactivo")).toBeInTheDocument();
  });

  it("reactiva el puesto cuando el departamento y el superior están activos", async () => {
    mockApiFetch({
      puesto: { ...PUESTO, activo: false },
      patch: (path) => {
        if (path !== `/api/puestos/${PUESTO.id}/estado`) return undefined;
        return new Response(JSON.stringify({ ...PUESTO, activo: true }));
      },
    });
    renderPagina();
    await waitFor(() => expect(screen.getByText("Inactivo")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /reactivar puesto/i }));

    await waitFor(() => expect(screen.getByText("Activo")).toBeInTheDocument());
  });

  it("si GET /api/puestos/:id falla, muestra error con reintentar", async () => {
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
      expect(screen.getByText(/no se pudo cargar este puesto/i)).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();
  });
});

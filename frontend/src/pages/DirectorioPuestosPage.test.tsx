import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "../lib/apiClient";
import { DirectorioPuestosPage } from "./DirectorioPuestosPage";

vi.mock("../lib/apiClient", () => ({ apiFetch: vi.fn() }));
vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

const DEPARTAMENTOS = [{ id: "dep-1", nombre_departamento: "Ventas" }];

const PUESTOS = [
  {
    id: "puesto-1",
    departamento_id: "dep-1",
    nombre_puesto: "Director Comercial",
    nivel: "direccion",
    plazas_totales: 1,
    reporta_a_id: null,
    activo: true,
    creado_en: "2026-08-31T00:00:00+00:00",
    actualizado_en: "2026-08-31T00:00:00+00:00",
  },
  {
    id: "puesto-2",
    departamento_id: "dep-1",
    nombre_puesto: "Ejecutivo de Ventas",
    nivel: "operativo",
    plazas_totales: 5,
    reporta_a_id: "puesto-1",
    activo: false,
    creado_en: "2026-08-31T00:00:00+00:00",
    actualizado_en: "2026-08-31T00:00:00+00:00",
  },
];

function mockApiFetch(respuestaPuestos: Response, respuestaDepartamentos?: Response) {
  vi.mocked(apiFetch).mockImplementation((path: string) => {
    if (path === "/api/sesion") {
      return Promise.resolve(
        new Response(JSON.stringify({ acceso_permitido: true, motivo_bloqueo: null }))
      );
    }
    if (path === "/api/departamentos") {
      return Promise.resolve(respuestaDepartamentos ?? new Response(JSON.stringify(DEPARTAMENTOS)));
    }
    return Promise.resolve(respuestaPuestos);
  });
}

describe("DirectorioPuestosPage", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it("lista los puestos con departamento, nivel traducido, reporta-a y plazas resueltos sin fetch extra", async () => {
    mockApiFetch(new Response(JSON.stringify(PUESTOS)));

    render(<DirectorioPuestosPage />);

    await waitFor(() =>
      expect(screen.getAllByText("Director Comercial").length).toBeGreaterThan(0)
    );
    expect(screen.getAllByText("Ventas").length).toBeGreaterThan(0);
    expect(screen.getByText("Dirección")).toBeInTheDocument();
    expect(screen.getByText("Operativo")).toBeInTheDocument();
    // "reporta a" del segundo puesto se resuelve contra el propio listado de /api/puestos
    expect(screen.getByText("Ejecutivo de Ventas").closest("tr")).toHaveTextContent(
      "Director Comercial"
    );
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Activo", { selector: "span.insignia" })).toBeInTheDocument();
    expect(screen.getByText("Inactivo", { selector: "span.insignia" })).toBeInTheDocument();
    // sólo dos llamadas propias de la página (+ la del guard de sesión): sin fetch extra por puesto
    expect(apiFetch).toHaveBeenCalledTimes(3);
  });

  it("calcula las métricas (total, activos, inactivos)", async () => {
    mockApiFetch(new Response(JSON.stringify(PUESTOS)));

    render(<DirectorioPuestosPage />);

    await waitFor(() =>
      expect(screen.getAllByText("Director Comercial").length).toBeGreaterThan(0)
    );
    expect(screen.getByText("Activos").closest(".metrica")).toHaveTextContent("1");
    expect(screen.getByText("Inactivos").closest(".metrica")).toHaveTextContent("1");
  });

  it("filtra por texto de búsqueda", async () => {
    mockApiFetch(new Response(JSON.stringify(PUESTOS)));

    render(<DirectorioPuestosPage />);
    await waitFor(() =>
      expect(screen.getAllByText("Director Comercial").length).toBeGreaterThan(0)
    );

    await userEvent.type(screen.getByLabelText(/buscar por nombre/i), "ejecutivo");

    // "Director Comercial" ya no tiene fila propia (queda sólo como texto de "reporta a" en
    // la fila de Ejecutivo de Ventas), así que se verifica por el link de la fila, no por texto.
    expect(
      screen.queryByRole("link", { name: "Director Comercial" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("Ejecutivo de Ventas")).toBeInTheDocument();
  });

  it("muestra el estado vacío cuando no hay puestos", async () => {
    mockApiFetch(new Response(JSON.stringify([])));

    render(<DirectorioPuestosPage />);

    await waitFor(() =>
      expect(
        screen.getByText(/no hay puestos registrados o tu cuenta no tiene acceso al catálogo/i)
      ).toBeInTheDocument()
    );
  });

  it("muestra el estado de error con opción de reintentar", async () => {
    mockApiFetch(new Response(null, { status: 500 }));

    render(<DirectorioPuestosPage />);

    await waitFor(() =>
      expect(screen.getByText(/no se pudo cargar el listado de puestos/i)).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();
  });
});

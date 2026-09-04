import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "../lib/apiClient";
import { AsignacionesPage } from "./AsignacionesPage";

vi.mock("../lib/apiClient", () => ({ apiFetch: vi.fn() }));
vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

const ASIGNACIONES = [
  {
    id: "asignacion-ficticia-1",
    persona_id: "persona-ficticia-1",
    persona_nombre: "Persona Ficticia Uno",
    puesto_id: "puesto-ficticio-1",
    nombre_puesto: "Puesto Ficticio Uno",
    nombre_departamento: "Departamento Ficticio Uno",
    nombre_area: "Área Ficticia Uno",
    vigente_desde: "2025-01-01",
    vigente_hasta: null,
  },
  {
    id: "asignacion-ficticia-2",
    persona_id: "persona-ficticia-2",
    persona_nombre: "Persona Ficticia Dos",
    puesto_id: "puesto-ficticio-2",
    nombre_puesto: "Puesto Ficticio Dos",
    nombre_departamento: "Departamento Ficticio Dos",
    nombre_area: "Área Ficticia Dos",
    vigente_desde: "2024-06-01",
    vigente_hasta: "2024-12-31",
  },
];

function mockApiFetch(respuesta: Response) {
  vi.mocked(apiFetch).mockImplementation((path: string) => {
    if (path === "/api/sesion") {
      return Promise.resolve(
        new Response(JSON.stringify({ acceso_permitido: true, motivo_bloqueo: null }))
      );
    }
    return Promise.resolve(respuesta);
  });
}

describe("AsignacionesPage", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  // persona_nombre y nombre_puesto son texto plano dentro de un mismo <p class="persona-celda">
  // (junto al avatar y al ícono de flecha) -- no forman su propio elemento, así que getByText
  // necesita el selector para no comparar contra el textContent completo del párrafo.
  const filaPersona = (texto: string | RegExp) =>
    screen.getByText(texto, { selector: "p.persona-celda" });
  const filaPersonaQuery = (texto: string | RegExp) =>
    screen.queryByText(texto, { selector: "p.persona-celda" });

  it("lista las asignaciones agrupadas, con persona → puesto y estado", async () => {
    mockApiFetch(new Response(JSON.stringify(ASIGNACIONES)));

    render(<AsignacionesPage />);

    await waitFor(() => expect(filaPersona(/Persona Ficticia Uno/)).toBeInTheDocument());
    expect(filaPersona(/Puesto Ficticio Uno/)).toBeInTheDocument();
    expect(filaPersona(/Persona Ficticia Dos/)).toBeInTheDocument();
    expect(screen.getByText("Vigente", { selector: "span.insignia" })).toBeInTheDocument();
    expect(screen.getByText("Terminada", { selector: "span.insignia" })).toBeInTheDocument();
  });

  it("calcula las métricas (total, vigentes, terminadas)", async () => {
    mockApiFetch(new Response(JSON.stringify(ASIGNACIONES)));

    render(<AsignacionesPage />);

    await waitFor(() => expect(filaPersona(/Persona Ficticia Uno/)).toBeInTheDocument());
    expect(
      screen.getByText("Vigentes", { selector: ".etiqueta-metrica" }).closest(".metrica")
    ).toHaveTextContent("1");
    expect(
      screen.getByText("Terminadas", { selector: ".etiqueta-metrica" }).closest(".metrica")
    ).toHaveTextContent("1");
  });

  it("filtra por texto de búsqueda (persona o puesto)", async () => {
    mockApiFetch(new Response(JSON.stringify(ASIGNACIONES)));

    render(<AsignacionesPage />);
    await waitFor(() => expect(filaPersona(/Persona Ficticia Uno/)).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText(/buscar por persona o puesto/i), "ficticia dos");

    expect(filaPersonaQuery(/Persona Ficticia Uno/)).not.toBeInTheDocument();
    expect(filaPersona(/Persona Ficticia Dos/)).toBeInTheDocument();
  });

  it("filtra por estado (vigente/terminada)", async () => {
    mockApiFetch(new Response(JSON.stringify(ASIGNACIONES)));

    render(<AsignacionesPage />);
    await waitFor(() => expect(filaPersona(/Persona Ficticia Uno/)).toBeInTheDocument());

    await userEvent.selectOptions(screen.getByLabelText(/filtrar por estado/i), "terminada");

    expect(filaPersonaQuery(/Persona Ficticia Uno/)).not.toBeInTheDocument();
    expect(filaPersona(/Persona Ficticia Dos/)).toBeInTheDocument();
  });

  it("sólo muestra acciones Terminar/Cambiar de puesto en asignaciones vigentes", async () => {
    mockApiFetch(new Response(JSON.stringify(ASIGNACIONES)));

    render(<AsignacionesPage />);
    await waitFor(() => expect(filaPersona(/Persona Ficticia Uno/)).toBeInTheDocument());

    expect(
      screen.getByRole("link", { name: /^terminar$/i })
    ).toHaveAttribute("href", "/estructura/asignaciones/asignacion-ficticia-1/terminar");
    // la terminada (asignacion-ficticia-2) no tiene acciones
    expect(screen.getAllByRole("link", { name: /^terminar$/i })).toHaveLength(1);
  });

  it("muestra el estado vacío cuando no hay asignaciones", async () => {
    mockApiFetch(new Response(JSON.stringify([])));

    render(<AsignacionesPage />);

    await waitFor(() =>
      expect(
        screen.getByText(/no hay asignaciones registradas o tu cuenta no tiene acceso al historial/i)
      ).toBeInTheDocument()
    );
  });

  it("muestra el estado de error con opción de reintentar", async () => {
    mockApiFetch(new Response(null, { status: 500 }));

    render(<AsignacionesPage />);

    await waitFor(() =>
      expect(
        screen.getByText(/no se pudo cargar el listado de asignaciones/i)
      ).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();
  });
});

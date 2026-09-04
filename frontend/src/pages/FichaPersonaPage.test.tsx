import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { apiFetch } from "../lib/apiClient";
import { FichaPersonaPage } from "./FichaPersonaPage";

vi.mock("../lib/apiClient", () => ({ apiFetch: vi.fn() }));
vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

const PERSONA = {
  id: "11111111-2222-3333-4444-555555555555",
  primer_nombre: "Mariana",
  segundo_nombre: "Guadalupe",
  apellido_paterno: "Alcántara",
  apellido_materno: "Ruvalcaba",
  curp: "AARM910427MDFLVR03",
  rfc: "AARM910427H8A",
  nss: "62119145338",
  fecha_nacimiento: "1991-04-27",
  fecha_ingreso: "2022-03-14",
  estado: "activo",
  tipo_contrato: "indefinido",
  documento_ref: "RTB-2026-001",
};

const MOVIMIENTOS = [
  {
    id: "m1",
    persona_id: PERSONA.id,
    tipo_movimiento: "alta",
    fecha_efectiva: "2022-03-14T09:00:00Z",
    motivo: null,
    registrado_por_nombre: null,
  },
  {
    id: "m2",
    persona_id: PERSONA.id,
    tipo_movimiento: "suspension",
    fecha_efectiva: "2023-06-01T09:00:00Z",
    motivo: "Licencia sin goce de sueldo",
    registrado_por_nombre: "mariana.renteria",
  },
];

function mockApiFetch() {
  vi.mocked(apiFetch).mockImplementation((path: string) => {
    if (path === "/api/sesion") {
      return Promise.resolve(
        new Response(JSON.stringify({ acceso_permitido: true, motivo_bloqueo: null }))
      );
    }
    if (path.endsWith("/movimientos")) {
      return Promise.resolve(new Response(JSON.stringify(MOVIMIENTOS)));
    }
    return Promise.resolve(new Response(JSON.stringify(PERSONA)));
  });
}

function renderPagina() {
  render(
    <MemoryRouter initialEntries={[`/personas/${PERSONA.id}`]}>
      <Routes>
        <Route path="/personas/:id" element={<FichaPersonaPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("FichaPersonaPage", () => {
  it("muestra identidad, datos personales y expediente", async () => {
    mockApiFetch();
    renderPagina();

    await waitFor(() =>
      expect(
        screen.getAllByText("Mariana Guadalupe Alcántara Ruvalcaba").length
      ).toBeGreaterThan(0)
    );

    expect(screen.getByText(PERSONA.rfc, { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText(PERSONA.nss, { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("27 abr 1991")).toBeInTheDocument();
    expect(screen.getByText(PERSONA.documento_ref)).toBeInTheDocument();
    expect(screen.getByText("Indefinido", { selector: "strong" })).toBeInTheDocument();
  });

  it("nunca muestra 'Indeterminado' para tipo_contrato (usa el enum real)", async () => {
    mockApiFetch();
    renderPagina();

    await waitFor(() =>
      expect(screen.getByText(PERSONA.documento_ref)).toBeInTheDocument()
    );
    expect(screen.queryByText(/indeterminado/i)).not.toBeInTheDocument();
  });

  it("resume el historial de estado a los últimos movimientos, con autor y link a la bitácora completa", async () => {
    mockApiFetch();
    renderPagina();

    await waitFor(() =>
      expect(screen.getByText(PERSONA.documento_ref)).toBeInTheDocument()
    );

    expect(screen.getByText("mariana.renteria")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /ver bitácora completa/i })
    ).toHaveAttribute("href", `/personas/${PERSONA.id}/bitacora`);
  });

  it("si GET /api/personas/:id falla, muestra un error con reintentar en vez de quedarse en Cargando…", async () => {
    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path === "/api/sesion") {
        return Promise.resolve(
          new Response(JSON.stringify({ acceso_permitido: true, motivo_bloqueo: null }))
        );
      }
      if (path.endsWith("/movimientos")) {
        return Promise.resolve(new Response(JSON.stringify(MOVIMIENTOS)));
      }
      // GET /api/personas/:id — el que backend confirmó que a veces devuelve 500
      return Promise.resolve(new Response(null, { status: 500 }));
    });

    renderPagina();

    await waitFor(() =>
      expect(
        screen.getByText(/no se pudo cargar la ficha de esta persona/i)
      ).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();
    expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument();
  });

  it("reintentar vuelve a pedir los datos y, si funciona, muestra la ficha", async () => {
    let intento = 0;
    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path === "/api/sesion") {
        return Promise.resolve(
          new Response(JSON.stringify({ acceso_permitido: true, motivo_bloqueo: null }))
        );
      }
      if (path.endsWith("/movimientos")) {
        return Promise.resolve(new Response(JSON.stringify(MOVIMIENTOS)));
      }
      intento += 1;
      if (intento === 1) return Promise.resolve(new Response(null, { status: 500 }));
      return Promise.resolve(new Response(JSON.stringify(PERSONA)));
    });

    renderPagina();

    await waitFor(() =>
      expect(
        screen.getByText(/no se pudo cargar la ficha de esta persona/i)
      ).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole("button", { name: /reintentar/i }));

    await waitFor(() =>
      expect(screen.getAllByText("Mariana Guadalupe Alcántara Ruvalcaba").length).toBeGreaterThan(0)
    );
  });

  it("una persona sin expediente (documento_ref/tipo_contrato null) no rompe, muestra los fallbacks", async () => {
    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path === "/api/sesion") {
        return Promise.resolve(
          new Response(JSON.stringify({ acceso_permitido: true, motivo_bloqueo: null }))
        );
      }
      if (path.endsWith("/movimientos")) {
        return Promise.resolve(new Response(JSON.stringify([])));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ ...PERSONA, tipo_contrato: null, documento_ref: null }))
      );
    });

    renderPagina();

    await waitFor(() =>
      expect(
        screen.getAllByText("Mariana Guadalupe Alcántara Ruvalcaba").length
      ).toBeGreaterThan(0)
    );
    expect(screen.getByText(/sin expediente asignado/i)).toBeInTheDocument();
  });
});

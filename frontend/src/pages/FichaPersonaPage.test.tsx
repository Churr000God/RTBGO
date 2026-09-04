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
  tiene_usuario: false,
  puestos_vigentes: [] as Array<Record<string, unknown>>,
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

const ASIGNACIONES: Array<Record<string, unknown>> = [];

// FichaPersonaPage hace un tercer fetch a /api/asignaciones (historial de puestos, filtrado en
// cliente por persona_id) además de /api/personas/:id y /api/personas/:id/movimientos — sin esta
// rama, el catch-all le devolvía el JSON de PERSONA y el .filter() del array explotaba (regresión
// real detectada al extender esta suite para el corte de asignación).
function mockApiFetch(asignaciones: Array<Record<string, unknown>> = ASIGNACIONES) {
  vi.mocked(apiFetch).mockImplementation((path: string) => {
    if (path === "/api/sesion") {
      return Promise.resolve(
        new Response(JSON.stringify({ acceso_permitido: true, motivo_bloqueo: null }))
      );
    }
    if (path.endsWith("/movimientos")) {
      return Promise.resolve(new Response(JSON.stringify(MOVIMIENTOS)));
    }
    if (path === "/api/asignaciones") {
      return Promise.resolve(new Response(JSON.stringify(asignaciones)));
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
    // hay dos links "Ver bitácora completa →" (historial de estado e historial de puestos) —
    // se distingue por href.
    const linksBitacora = screen.getAllByRole("link", { name: /ver bitácora completa/i });
    expect(
      linksBitacora.some(
        (link) => link.getAttribute("href") === `/personas/${PERSONA.id}/bitacora`
      )
    ).toBe(true);
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
      if (path === "/api/asignaciones") {
        return Promise.resolve(new Response(JSON.stringify(ASIGNACIONES)));
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
      if (path === "/api/asignaciones") {
        return Promise.resolve(new Response(JSON.stringify(ASIGNACIONES)));
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

  it("muestra 'Crear acceso a Kairos' cuando la persona no tiene usuario vinculado", async () => {
    mockApiFetch();
    renderPagina();

    await waitFor(() =>
      expect(screen.getAllByText("Mariana Guadalupe Alcántara Ruvalcaba").length).toBeGreaterThan(0)
    );
    expect(
      screen.getByRole("link", { name: /crear acceso a kairos/i })
    ).toHaveAttribute("href", `/usuarios/nuevo?persona_id=${PERSONA.id}`);
  });

  it("oculta 'Crear acceso a Kairos' cuando la persona ya tiene usuario vinculado", async () => {
    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path === "/api/sesion") {
        return Promise.resolve(
          new Response(JSON.stringify({ acceso_permitido: true, motivo_bloqueo: null }))
        );
      }
      if (path.endsWith("/movimientos")) {
        return Promise.resolve(new Response(JSON.stringify(MOVIMIENTOS)));
      }
      if (path === "/api/asignaciones") {
        return Promise.resolve(new Response(JSON.stringify(ASIGNACIONES)));
      }
      return Promise.resolve(new Response(JSON.stringify({ ...PERSONA, tiene_usuario: true })));
    });
    renderPagina();

    await waitFor(() =>
      expect(screen.getAllByText("Mariana Guadalupe Alcántara Ruvalcaba").length).toBeGreaterThan(0)
    );
    expect(
      screen.queryByRole("link", { name: /crear acceso a kairos/i })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /nuevo movimiento/i })).toBeInTheDocument();
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
      if (path === "/api/asignaciones") {
        return Promise.resolve(new Response(JSON.stringify(ASIGNACIONES)));
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

  it("muestra 'Sin puesto asignado actualmente' cuando puestos_vigentes está vacío", async () => {
    mockApiFetch();
    renderPagina();

    await waitFor(() =>
      expect(screen.getAllByText("Mariana Guadalupe Alcántara Ruvalcaba").length).toBeGreaterThan(0)
    );
    expect(screen.getByText(/sin puesto asignado actualmente/i)).toBeInTheDocument();
  });

  it("lista la asignación actual (puestos_vigentes) con acciones de terminar y cambiar de puesto", async () => {
    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path === "/api/sesion") {
        return Promise.resolve(
          new Response(JSON.stringify({ acceso_permitido: true, motivo_bloqueo: null }))
        );
      }
      if (path.endsWith("/movimientos")) {
        return Promise.resolve(new Response(JSON.stringify(MOVIMIENTOS)));
      }
      if (path === "/api/asignaciones") {
        return Promise.resolve(new Response(JSON.stringify(ASIGNACIONES)));
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ...PERSONA,
            puestos_vigentes: [
              {
                asignacion_id: "asignacion-ficticia-1",
                puesto_id: "puesto-ficticio-1",
                nombre_puesto: "Puesto Ficticio Uno",
                nombre_departamento: "Departamento Ficticio Uno",
                nombre_area: "Área Ficticia Uno",
              },
            ],
          })
        )
      );
    });

    renderPagina();

    await waitFor(() => expect(screen.getByText("Puesto Ficticio Uno")).toBeInTheDocument());
    expect(screen.getByText(/departamento ficticio uno/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^terminar$/i })).toHaveAttribute(
      "href",
      "/estructura/asignaciones/asignacion-ficticia-1/terminar"
    );
    expect(screen.getByRole("link", { name: /cambiar de puesto/i })).toHaveAttribute(
      "href",
      "/estructura/asignaciones/asignacion-ficticia-1/cambiar-puesto"
    );
  });

  it("muestra 'Sin asignaciones registradas todavía' cuando el historial de puestos está vacío", async () => {
    mockApiFetch();
    renderPagina();

    await waitFor(() =>
      expect(screen.getAllByText("Mariana Guadalupe Alcántara Ruvalcaba").length).toBeGreaterThan(0)
    );
    expect(screen.getByText(/sin asignaciones registradas todavía/i)).toBeInTheDocument();
  });

  it("resume el historial de puestos a las últimas asignaciones, con link a la bitácora completa", async () => {
    mockApiFetch([
      {
        id: "asignacion-ficticia-2",
        persona_id: PERSONA.id,
        nombre_puesto: "Puesto Ficticio Dos",
        vigente_desde: "2024-01-01",
        vigente_hasta: "2025-01-01",
      },
      {
        id: "asignacion-ficticia-3",
        persona_id: PERSONA.id,
        nombre_puesto: "Puesto Ficticio Tres",
        vigente_desde: "2025-01-02",
        vigente_hasta: null,
      },
      // de otra persona — el filtrado en cliente por persona_id debe excluirla
      {
        id: "asignacion-ajena",
        persona_id: "otra-persona-ficticia",
        nombre_puesto: "Puesto Ficticio Ajeno",
        vigente_desde: "2025-06-01",
        vigente_hasta: null,
      },
    ]);
    renderPagina();

    await waitFor(() => expect(screen.getByText("Puesto Ficticio Tres")).toBeInTheDocument());
    expect(screen.getByText("Puesto Ficticio Dos")).toBeInTheDocument();
    expect(screen.queryByText("Puesto Ficticio Ajeno")).not.toBeInTheDocument();
    // hay dos links "Ver bitácora completa →" (historial de puestos e historial de estado) —
    // se distingue por href.
    const linksBitacora = screen.getAllByRole("link", { name: /ver bitácora completa/i });
    expect(
      linksBitacora.some(
        (link) => link.getAttribute("href") === `/personas/${PERSONA.id}/bitacora-asignaciones`
      )
    ).toBe(true);
  });
});

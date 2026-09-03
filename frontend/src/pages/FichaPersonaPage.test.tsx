import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { apiFetch } from "../lib/apiClient";
import { FichaPersonaPage } from "./FichaPersonaPage";

vi.mock("../lib/apiClient", () => ({ apiFetch: vi.fn() }));

describe("FichaPersonaPage", () => {
  it("muestra identidad, expediente e historial de estado", async () => {
    vi.mocked(apiFetch).mockImplementation((path) => {
      if (path.endsWith("/movimientos")) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              { id: "m1", tipo_movimiento: "alta", fecha_efectiva: "2026-01-01T09:00:00Z", motivo: null },
            ])
          )
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: "1",
            primer_nombre: "Mariana",
            apellido_paterno: "Alcántara",
            curp: "AARM910427MDFLVR03",
            estado: "activo",
            tipo_contrato: "indefinido",
            documento_ref: "RTB-2026-001",
          })
        )
      );
    });

    render(
      <MemoryRouter initialEntries={["/personas/1"]}>
        <Routes>
          <Route path="/personas/:id" element={<FichaPersonaPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText(/mariana alcántara/i)).toBeInTheDocument());
    expect(screen.getByText(/rtb-2026-001/i)).toBeInTheDocument();
    expect(screen.getByText(/alta/i)).toBeInTheDocument();
  });
});

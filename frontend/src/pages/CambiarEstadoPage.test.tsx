import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { apiFetch } from "../lib/apiClient";
import { CambiarEstadoPage } from "./CambiarEstadoPage";

vi.mock("../lib/apiClient", () => ({ apiFetch: vi.fn() }));

describe("CambiarEstadoPage", () => {
  it("exige motivo y envía el movimiento elegido", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(JSON.stringify({ id: "m1" }), { status: 201 }));

    render(
      <MemoryRouter initialEntries={["/personas/1/movimiento"]}>
        <Routes>
          <Route path="/personas/:id/movimiento" element={<CambiarEstadoPage />} />
        </Routes>
      </MemoryRouter>
    );

    await userEvent.click(screen.getByLabelText(/suspensión/i));
    await userEvent.type(screen.getByLabelText(/motivo/i), "Licencia sin goce de sueldo");
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/personas/1/movimientos",
      expect.objectContaining({ method: "POST" })
    );
  });
});

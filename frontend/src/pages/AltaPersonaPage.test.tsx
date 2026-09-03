import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { apiFetch } from "../lib/apiClient";
import { AltaPersonaPage } from "./AltaPersonaPage";

vi.mock("../lib/apiClient", () => ({ apiFetch: vi.fn() }));

describe("AltaPersonaPage", () => {
  it("envía los datos del formulario a POST /api/personas", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(JSON.stringify({ id: "1" }), { status: 201 }));

    render(<AltaPersonaPage />);
    await userEvent.type(screen.getByLabelText(/primer nombre/i), "Mariana");
    await userEvent.type(screen.getByLabelText(/apellido paterno/i), "Alcántara");
    await userEvent.type(screen.getByLabelText(/curp/i), "AARM910427MDFLVR03");
    await userEvent.type(screen.getByLabelText(/rfc/i), "AARM910427H8A");
    await userEvent.type(screen.getByLabelText(/nss/i), "62119145338");
    await userEvent.type(screen.getByLabelText(/fecha de nacimiento/i), "1991-04-27");
    await userEvent.type(screen.getByLabelText(/fecha de ingreso/i), "2026-01-01");
    await userEvent.type(screen.getByLabelText(/documento_ref/i), "RTB-2026-001");
    await userEvent.click(screen.getByRole("button", { name: /registrar alta/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/personas",
        expect.objectContaining({ method: "POST" })
      )
    );
    const cuerpo = JSON.parse(vi.mocked(apiFetch).mock.calls[0][1]!.body as string);
    expect(cuerpo.curp).toBe("AARM910427MDFLVR03");
  });
});

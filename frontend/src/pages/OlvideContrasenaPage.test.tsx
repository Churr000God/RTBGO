import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { supabase } from "../lib/supabaseClient";
import { OlvideContrasenaPage } from "./OlvideContrasenaPage";

vi.mock("../lib/supabaseClient", () => ({
  supabase: { auth: { resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }) } },
}));

describe("OlvideContrasenaPage", () => {
  it("confirma el envío del enlace", async () => {
    render(<OlvideContrasenaPage />);
    await userEvent.type(screen.getByLabelText(/correo/i), "mariana@example.com");
    await userEvent.click(screen.getByRole("button", { name: /enviar enlace/i }));

    await waitFor(() => expect(screen.getByText(/revisa tu correo/i)).toBeInTheDocument());
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith("mariana@example.com", {
      redirectTo: expect.stringContaining("/restablecer-contrasena"),
    });
  });
});

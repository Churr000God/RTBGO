import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { supabase } from "../lib/supabaseClient";
import { LoginPage } from "./LoginPage";

vi.mock("../lib/supabaseClient", () => ({
  supabase: { auth: { signInWithPassword: vi.fn() } },
}));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.mocked(supabase.auth.signInWithPassword).mockReset();
  });

  it("muestra error de credenciales inválidas sin salir de la pantalla", async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials", name: "AuthApiError", status: 400 },
    } as never);

    render(<LoginPage />);
    await userEvent.type(screen.getByLabelText(/correo/i), "mariana@example.com");
    await userEvent.type(screen.getByLabelText("Contraseña"), "malacontrasena");
    await userEvent.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    await waitFor(() =>
      expect(screen.getByText(/credenciales inválidas/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/te quedan 4 intentos/i)).toBeInTheDocument();
  });
});

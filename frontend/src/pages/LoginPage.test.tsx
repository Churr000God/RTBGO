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

  it("cambia el título y la bajada del panel cuando hay error", async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials", name: "AuthApiError", status: 400 },
    } as never);

    render(<LoginPage />);
    expect(screen.getByText("El tiempo de tu gente, en orden.")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/correo/i), "mariana@example.com");
    await userEvent.type(screen.getByLabelText("Contraseña"), "malacontrasena");
    await userEvent.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    await waitFor(() =>
      expect(screen.getByText("No pudimos verificar tu acceso.")).toBeInTheDocument()
    );
    expect(
      screen.queryByText("El tiempo de tu gente, en orden.")
    ).not.toBeInTheDocument();
  });

  it("marca el campo de contraseña como inválido y muestra el hint tras un error", async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials", name: "AuthApiError", status: 400 },
    } as never);

    render(<LoginPage />);
    const contrasena = screen.getByLabelText("Contraseña");
    expect(contrasena).not.toHaveAttribute("aria-invalid");

    await userEvent.type(screen.getByLabelText(/correo/i), "mariana@example.com");
    await userEvent.type(contrasena, "malacontrasena");
    await userEvent.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    await waitFor(() => expect(contrasena).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByText(/distingue mayúsculas y minúsculas/i)).toBeInTheDocument();
    expect(contrasena).toHaveAttribute("aria-describedby", "hint-contrasena");
  });
});

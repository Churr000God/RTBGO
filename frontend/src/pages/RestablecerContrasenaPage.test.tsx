import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RestablecerContrasenaPage } from "./RestablecerContrasenaPage";

describe("RestablecerContrasenaPage", () => {
  afterEach(() => {
    window.location.hash = "";
  });

  it("muestra el enlace vencido en vez del formulario cuando Supabase lo marca en el hash", () => {
    window.location.hash = "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";

    render(<RestablecerContrasenaPage />);

    expect(screen.getByText(/este enlace venció/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /solicitar un enlace nuevo/i })).toHaveAttribute(
      "href",
      "/olvide-contrasena"
    );
    expect(screen.queryByLabelText(/nueva contraseña/i)).not.toBeInTheDocument();
  });
});

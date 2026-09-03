import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { apiFetch } from "../lib/apiClient";
import { DirectorioPersonasPage } from "./DirectorioPersonasPage";

vi.mock("../lib/apiClient", () => ({ apiFetch: vi.fn() }));

describe("DirectorioPersonasPage", () => {
  it("lista las personas devueltas por el backend", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(
        JSON.stringify([
          { id: "1", primer_nombre: "Mariana", apellido_paterno: "Alcántara", estado: "activo" },
        ])
      )
    );

    render(<DirectorioPersonasPage />);

    await waitFor(() => expect(screen.getByText(/mariana alcántara/i)).toBeInTheDocument());
  });
});

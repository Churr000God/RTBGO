import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "../lib/apiClient";
import { DirectorioPersonasPage } from "./DirectorioPersonasPage";

vi.mock("../lib/apiClient", () => ({ apiFetch: vi.fn() }));

const PERSONAS = [
  {
    id: "1",
    primer_nombre: "Mariana",
    apellido_paterno: "Alcántara",
    estado: "activo",
    fecha_ingreso: "2022-03-14",
    fecha_baja: null,
  },
  {
    id: "2",
    primer_nombre: "Jorge",
    apellido_paterno: "Peña",
    estado: "suspension",
    fecha_ingreso: "2021-09-17",
    fecha_baja: null,
  },
  {
    id: "3",
    primer_nombre: "Karla",
    apellido_paterno: "Mendieta",
    estado: "baja_definitiva",
    fecha_ingreso: "2019-07-04",
    fecha_baja: new Date().toISOString().slice(0, 10),
  },
];

describe("DirectorioPersonasPage", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it("lista las personas devueltas por el backend, sin una segunda petición", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(JSON.stringify(PERSONAS)));

    render(<DirectorioPersonasPage />);

    await waitFor(() => expect(screen.getByText(/mariana alcántara/i)).toBeInTheDocument());
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it("tolera personas sin fecha_ingreso/fecha_baja (undefined)", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(
        JSON.stringify([{ id: "1", primer_nombre: "Mariana", apellido_paterno: "Alcántara", estado: "activo" }])
      )
    );

    render(<DirectorioPersonasPage />);

    await waitFor(() => expect(screen.getByText(/mariana alcántara/i)).toBeInTheDocument());
  });

  it("calcula las métricas correctas (total, activos, suspensión, bajas del mes)", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(JSON.stringify(PERSONAS)));

    render(<DirectorioPersonasPage />);

    await waitFor(() => expect(screen.getByText(/mariana alcántara/i)).toBeInTheDocument());
    expect(screen.getByText("3")).toBeInTheDocument(); // total
    expect(screen.getByText("Activos").closest(".metrica")).toHaveTextContent("1");
    expect(screen.getByText(/suspensión temporal/i).closest(".metrica")).toHaveTextContent("1");
    expect(screen.getByText(/bajas del mes/i).closest(".metrica")).toHaveTextContent("1");
  });

  it("filtra por texto de búsqueda (nombre)", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(JSON.stringify(PERSONAS)));

    render(<DirectorioPersonasPage />);
    await waitFor(() => expect(screen.getByText(/mariana alcántara/i)).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText(/buscar por nombre/i), "jorge");

    expect(screen.queryByText(/mariana alcántara/i)).not.toBeInTheDocument();
    expect(screen.getByText(/jorge peña/i)).toBeInTheDocument();
  });

  it("filtra por estado", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(JSON.stringify(PERSONAS)));

    render(<DirectorioPersonasPage />);
    await waitFor(() => expect(screen.getByText(/mariana alcántara/i)).toBeInTheDocument());

    await userEvent.selectOptions(screen.getByLabelText(/filtrar por estado/i), "suspension");

    expect(screen.queryByText(/mariana alcántara/i)).not.toBeInTheDocument();
    expect(screen.getByText(/jorge peña/i)).toBeInTheDocument();
  });

  it("muestra el estado vacío con copy propio cuando no hay personas", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(JSON.stringify([])));

    render(<DirectorioPersonasPage />);

    await waitFor(() =>
      expect(
        screen.getByText(/no hay personas registradas o tu cuenta no tiene acceso al padrón/i)
      ).toBeInTheDocument()
    );
  });

  it("muestra el estado de error con opción de reintentar", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 500 }));

    render(<DirectorioPersonasPage />);

    await waitFor(() =>
      expect(screen.getByText(/no se pudo cargar el directorio/i)).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();
  });
});

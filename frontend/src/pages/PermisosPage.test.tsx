import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "../lib/apiClient";
import { PermisosPage } from "./PermisosPage";

vi.mock("../lib/apiClient", () => ({ apiFetch: vi.fn() }));
vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

const CATALOGO = [
  { codigo: "permiso_ficticio_uno", heredable: false, activo: true },
  { codigo: "permiso_ficticio_heredable", heredable: true, activo: true },
];

const MOVIMIENTOS = [
  {
    id: "bitacora-ficticia-1",
    puesto_id: "puesto-ficticio-1",
    nombre_puesto: "Puesto Ficticio Uno",
    codigo: "permiso_ficticio_uno",
    tipo_movimiento: "otorgado",
    fecha_efectiva: "2025-01-01T10:00:00+00:00",
    motivo: null,
    registrado_por_nombre: "caller.ficticio",
    creado_en: "2025-01-01T10:00:00+00:00",
  },
  {
    id: "bitacora-ficticia-2",
    puesto_id: "puesto-ficticio-2",
    nombre_puesto: "Puesto Ficticio Dos",
    codigo: "permiso_ficticio_heredable",
    tipo_movimiento: "revocado",
    fecha_efectiva: "2024-06-01T10:00:00+00:00",
    motivo: "Cambio de organigrama",
    registrado_por_nombre: null,
    creado_en: "2024-06-01T10:00:00+00:00",
  },
];

function mockApiFetch(overrides: { otorgados?: Response; catalogo?: Response } = {}) {
  vi.mocked(apiFetch).mockImplementation((path: string) => {
    if (path === "/api/sesion") {
      return Promise.resolve(
        new Response(JSON.stringify({ acceso_permitido: true, motivo_bloqueo: null }))
      );
    }
    if (path === "/api/permisos/otorgados") {
      return Promise.resolve(overrides.otorgados ?? new Response(JSON.stringify(MOVIMIENTOS)));
    }
    if (path === "/api/permisos") {
      return Promise.resolve(overrides.catalogo ?? new Response(JSON.stringify(CATALOGO)));
    }
    return Promise.reject(new Error(`ruta no mockeada: ${path}`));
  });
}

// nombre_puesto y codigo son texto plano dentro de un mismo <p> (junto a un ícono de flecha
// sin className propio) -- ninguno forma su propio elemento, así que getByText por defecto no
// los encuentra. Patrón recomendado por la doc de RTL para "texto partido por elementos": busca
// el elemento más profundo cuyo textContent contiene el texto y cuyos hijos NO lo contienen.
function elementoConTexto(texto: string) {
  return screen.getByText((_, nodo) => {
    if (!nodo || !(nodo.textContent ?? "").includes(texto)) return false;
    return Array.from(nodo.children).every((hijo) => !(hijo.textContent ?? "").includes(texto));
  });
}
function elementoConTextoQuery(texto: string) {
  return screen.queryByText((_, nodo) => {
    if (!nodo || !(nodo.textContent ?? "").includes(texto)) return false;
    return Array.from(nodo.children).every((hijo) => !(hijo.textContent ?? "").includes(texto));
  });
}

describe("PermisosPage", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it("lista los movimientos agrupados por año, con tipo, puesto, código y autor", async () => {
    mockApiFetch();

    render(<PermisosPage />);

    await waitFor(() => expect(elementoConTexto("Puesto Ficticio Uno")).toBeInTheDocument());
    expect(elementoConTexto("Puesto Ficticio Dos")).toBeInTheDocument();
    expect(screen.getByText("Otorgado", { selector: "span.insignia" })).toBeInTheDocument();
    expect(screen.getByText("Revocado", { selector: "span.insignia" })).toBeInTheDocument();
    expect(screen.getByText("caller.ficticio")).toBeInTheDocument();
    expect(screen.getByText("Cambio de organigrama")).toBeInTheDocument();
  });

  it("calcula las métricas (total, otorgamientos, revocaciones)", async () => {
    mockApiFetch();

    render(<PermisosPage />);

    await waitFor(() => expect(elementoConTexto("Puesto Ficticio Uno")).toBeInTheDocument());
    expect(
      screen.getByText("Otorgamientos", { selector: ".etiqueta-metrica" }).closest(".metrica")
    ).toHaveTextContent("1");
    expect(
      screen.getByText("Revocaciones", { selector: ".etiqueta-metrica" }).closest(".metrica")
    ).toHaveTextContent("1");
  });

  it("filtra por texto de búsqueda (puesto o código)", async () => {
    mockApiFetch();

    render(<PermisosPage />);
    await waitFor(() => expect(elementoConTexto("Puesto Ficticio Uno")).toBeInTheDocument());

    await userEvent.type(
      screen.getByLabelText(/buscar por puesto o código de permiso/i),
      "ficticio_heredable"
    );

    expect(elementoConTextoQuery("Puesto Ficticio Uno")).not.toBeInTheDocument();
    expect(elementoConTexto("Puesto Ficticio Dos")).toBeInTheDocument();
  });

  it("filtra por tipo de movimiento", async () => {
    mockApiFetch();

    render(<PermisosPage />);
    await waitFor(() => expect(elementoConTexto("Puesto Ficticio Uno")).toBeInTheDocument());

    await userEvent.selectOptions(screen.getByLabelText(/filtrar por tipo de movimiento/i), "revocado");

    expect(elementoConTextoQuery("Puesto Ficticio Uno")).not.toBeInTheDocument();
    expect(elementoConTexto("Puesto Ficticio Dos")).toBeInTheDocument();
  });

  it("muestra el catálogo de permisos en la barra lateral, con heredable/no heredable", async () => {
    mockApiFetch();

    render(<PermisosPage />);

    await waitFor(() => expect(screen.getByText("permiso_ficticio_uno")).toBeInTheDocument());
    expect(screen.getByText("permiso_ficticio_heredable")).toBeInTheDocument();
    expect(screen.getByText(/heredable — sube por reporta_a_id/i)).toBeInTheDocument();
    expect(screen.getByText(/no heredable — sólo el puesto que lo tiene/i)).toBeInTheDocument();
  });

  it("no tiene acciones inline en cada evento (decisión ya tomada)", async () => {
    mockApiFetch();

    render(<PermisosPage />);

    await waitFor(() => expect(elementoConTexto("Puesto Ficticio Uno")).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: /revocar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /revocar/i })).not.toBeInTheDocument();
  });

  it("muestra una nota fija indicando dónde revocar un permiso (ficha del puesto)", async () => {
    mockApiFetch();

    render(<PermisosPage />);

    await waitFor(() => expect(elementoConTexto("Puesto Ficticio Uno")).toBeInTheDocument());
    expect(screen.getByText(/para revocar un permiso, abrí la ficha del puesto/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /estructura organizacional.*puestos/i })).toHaveAttribute(
      "href",
      "/estructura/puestos"
    );
  });

  it("muestra el estado vacío cuando no hay movimientos", async () => {
    mockApiFetch({ otorgados: new Response(JSON.stringify([])) });

    render(<PermisosPage />);

    await waitFor(() =>
      expect(
        screen.getByText(
          /no hay movimientos de permisos registrados o tu cuenta no tiene acceso al historial/i
        )
      ).toBeInTheDocument()
    );
  });

  it("muestra el estado de error con opción de reintentar", async () => {
    mockApiFetch({ otorgados: new Response(null, { status: 500 }) });

    render(<PermisosPage />);

    await waitFor(() =>
      expect(screen.getByText(/no se pudo cargar el historial de permisos/i)).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();
  });
});

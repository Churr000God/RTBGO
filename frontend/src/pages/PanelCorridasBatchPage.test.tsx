import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "../lib/apiClient";
import { PanelCorridasBatchPage } from "./PanelCorridasBatchPage";

vi.mock("../lib/apiClient", () => ({ apiFetch: vi.fn() }));
vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

const CORRIDAS = [
  {
    id: 1,
    tipo_batch: "de_confianza",
    fecha: "2026-09-06",
    estado: "exitosa",
    intentos: 1,
    iniciado_en: "2026-09-06T10:00:00Z",
    terminado_en: "2026-09-06T10:00:05Z",
    detalle: "1 día(s) creado(s), 0 ya existían.",
  },
];

function mockApiFetch(opciones: {
  listado?: Response;
  disparar?: Response;
  dispararCorteQuincenal?: Response;
}) {
  vi.mocked(apiFetch).mockImplementation((path: string, init?: RequestInit) => {
    if (path === "/api/sesion") {
      return Promise.resolve(
        new Response(JSON.stringify({ acceso_permitido: true, motivo_bloqueo: null })),
      );
    }
    if (path === "/api/corridas-batch" && (!init || init.method === undefined)) {
      return Promise.resolve(opciones.listado ?? new Response(JSON.stringify(CORRIDAS)));
    }
    if (path === "/api/corridas-batch/de-confianza" && init?.method === "POST") {
      return Promise.resolve(
        opciones.disparar ?? new Response(JSON.stringify({ ...CORRIDAS[0], intentos: 2 })),
      );
    }
    if (path === "/api/corridas-batch/corte-quincenal" && init?.method === "POST") {
      return Promise.resolve(
        opciones.dispararCorteQuincenal ??
          new Response(
            JSON.stringify({
              id: 2,
              tipo_batch: "corte_quincenal",
              fecha: "2026-09-16",
              estado: "exitosa",
              intentos: 1,
              iniciado_en: "2026-09-16T10:00:00Z",
              terminado_en: "2026-09-16T10:00:05Z",
              detalle: "periodo 2026-09-01 a 2026-09-15: 1 procesada(s), 0 con déficit, 0 ya procesada(s), 0 pendiente(s) de cierre de día.",
            }),
          ),
      );
    }
    return Promise.reject(new Error(`ruta no mockeada: ${path}`));
  });
}

describe("PanelCorridasBatchPage", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it("lista las corridas devueltas por GET /api/corridas-batch", async () => {
    mockApiFetch({});

    render(<PanelCorridasBatchPage />);

    await waitFor(() => expect(screen.getByText("Jornada de confianza")).toBeInTheDocument());
    expect(screen.getByText("2026-09-06")).toBeInTheDocument();
    expect(screen.getByText("Exitosa")).toBeInTheDocument();
    expect(screen.getByText("1 día(s) creado(s), 0 ya existían.")).toBeInTheDocument();
  });

  it("muestra estado vacío cuando no hay corridas", async () => {
    mockApiFetch({ listado: new Response(JSON.stringify([])) });

    render(<PanelCorridasBatchPage />);

    await waitFor(() =>
      expect(screen.getByText(/todavía no hay corridas registradas/i)).toBeInTheDocument(),
    );
  });

  it("dispara la corrida manual de_confianza y recarga el listado", async () => {
    mockApiFetch({});

    render(<PanelCorridasBatchPage />);
    await waitFor(() => expect(screen.getByText("Jornada de confianza")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /disparar jornada de confianza/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/corridas-batch/de-confianza",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    // recarga: un segundo GET a /api/corridas-batch después del POST
    const llamadasListado = vi
      .mocked(apiFetch)
      .mock.calls.filter(([path, init]) => path === "/api/corridas-batch" && !init?.method);
    expect(llamadasListado.length).toBeGreaterThanOrEqual(2);
  });

  it("muestra un error legible cuando el backend rechaza el disparo manual", async () => {
    mockApiFetch({
      disparar: new Response(
        JSON.stringify({ detail: "No tenés el permiso necesario (corrida_batch_edicion)." }),
        { status: 403 },
      ),
    });

    render(<PanelCorridasBatchPage />);
    await waitFor(() => expect(screen.getByText("Jornada de confianza")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /disparar jornada de confianza/i }));

    await waitFor(() =>
      expect(
        screen.getByText("No tenés el permiso necesario (corrida_batch_edicion)."),
      ).toBeInTheDocument(),
    );
  });

  it("muestra el estado de error cuando falla la carga del listado", async () => {
    mockApiFetch({ listado: new Response(null, { status: 500 }) });

    render(<PanelCorridasBatchPage />);

    await waitFor(() =>
      expect(screen.getByText(/no se pudo cargar el listado de corridas/i)).toBeInTheDocument(),
    );
  });

  it("lista una corrida de corte_quincenal con la etiqueta correcta y dispara el tercer botón", async () => {
    mockApiFetch({
      listado: new Response(
        JSON.stringify([
          {
            id: 2,
            tipo_batch: "corte_quincenal",
            fecha: "2026-09-01",
            estado: "exitosa",
            intentos: 1,
            iniciado_en: "2026-09-01T10:00:00Z",
            terminado_en: "2026-09-01T10:00:05Z",
            detalle: "periodo 2026-08-16 a 2026-08-31: 1 procesada(s), 0 con déficit, 0 ya procesada(s), 0 pendiente(s) de cierre de día.",
          },
        ]),
      ),
    });

    render(<PanelCorridasBatchPage />);
    await waitFor(() => expect(screen.getByText("Corte quincenal")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /disparar corte quincenal/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/corridas-batch/corte-quincenal",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });
});

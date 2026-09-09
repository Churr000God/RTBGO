import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "../lib/apiClient";
import { BancoDeHorasPage } from "./BancoDeHorasPage";

vi.mock("../lib/apiClient", () => ({ apiFetch: vi.fn() }));
vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

const RESUMEN = {
  total_personas: 2,
  en_deuda: 1,
  sin_deuda: 1,
  horas_adeudadas: 4.5,
  horas_fuera_ventana: 0,
  personas_fuera_ventana: 0,
  ventana_meses: 6,
  top_en_deuda: [
    { persona_id: "persona-1", persona_nombre: "Persona Endeudada", monto: 4.5, meses_antiguedad_max: 1 },
  ],
};

const SALDO_ENDEUDADO = {
  persona_id: "persona-1",
  persona_nombre: "Persona Endeudada",
  monto: 4.5,
  vivo_desde: "2026-09-01T00:00:00Z",
  actualizado_en: "2026-09-06T10:00:00Z",
  horas_reciente: 4.5,
  horas_media: 0,
  horas_fuera_ventana: 0,
  meses_antiguedad_max: 1,
  conciliado: true,
};

const SALDO_AL_CORRIENTE = {
  persona_id: "persona-2",
  persona_nombre: "Persona Al Corriente",
  monto: 0,
  vivo_desde: null,
  actualizado_en: "2026-09-06T10:00:00Z",
  horas_reciente: 0,
  horas_media: 0,
  horas_fuera_ventana: 0,
  meses_antiguedad_max: 0,
  conciliado: true,
};

const MOVIMIENTOS = [
  {
    id: 2,
    creado_en: "2026-08-29T12:00:00Z",
    tipo: "cubrir",
    monto: -2.0,
    motivo: "cubrió falta",
    autor_nombre: null,
    saldo_corrido: 3.0,
    vivo: false,
  },
  {
    id: 1,
    creado_en: "2026-08-19T12:00:00Z",
    tipo: "generado_quincena",
    monto: 5.0,
    motivo: null,
    autor_nombre: null,
    saldo_corrido: 5.0,
    vivo: true,
  },
];

function mockApiFetch(opciones: { banco?: Response; movimientos?: Response } = {}) {
  vi.mocked(apiFetch).mockImplementation((path: string) => {
    if (path === "/api/sesion") {
      return Promise.resolve(
        new Response(JSON.stringify({ acceso_permitido: true, motivo_bloqueo: null })),
      );
    }
    if (path.startsWith("/api/banco-de-horas?")) {
      return Promise.resolve(
        opciones.banco ??
          new Response(
            JSON.stringify({ total: 2, resumen: RESUMEN, saldos: [SALDO_ENDEUDADO, SALDO_AL_CORRIENTE] }),
          ),
      );
    }
    if (path.endsWith("/movimientos")) {
      return Promise.resolve(
        opciones.movimientos ?? new Response(JSON.stringify({ total: 2, movimientos: MOVIMIENTOS })),
      );
    }
    return Promise.reject(new Error(`ruta no mockeada: ${path}`));
  });
}

describe("BancoDeHorasPage", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lista los saldos y muestra las métricas desde resumen", async () => {
    mockApiFetch();

    render(<BancoDeHorasPage />);

    const tabla = await screen.findByRole("table");
    await waitFor(() => expect(within(tabla).getByText("Persona Endeudada")).toBeInTheDocument());
    expect(within(tabla).getByText("Persona Al Corriente")).toBeInTheDocument();

    expect(screen.getByText("Personas con saldo").nextElementSibling).toHaveTextContent("2");
    expect(screen.getByText(/^en deuda$/i).nextElementSibling).toHaveTextContent("1");
    expect(screen.getByText("4.50 h acumuladas")).toBeInTheDocument();
    expect(screen.getByText(/fuera de ventana/i)).toBeInTheDocument();
    expect(screen.getByText(/mostrando 2 de 2 personas/i)).toBeInTheDocument();
  });

  it("muestra el top en deuda con gráfica de barras y la lista de personas sin deuda", async () => {
    mockApiFetch();

    render(<BancoDeHorasPage />);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Top en deuda" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("heading", { name: "Sin deuda" })).toBeInTheDocument();
    const tabla = screen.getByRole("table");
    expect(within(tabla).getByText("Persona Al Corriente")).toBeInTheDocument();
  });

  it("filtro por tramo de antigüedad manda tramo_antiguedad= en la query y resetea la página", async () => {
    mockApiFetch();

    render(<BancoDeHorasPage />);
    const tablaTramo = await screen.findByRole("table");
    await waitFor(() => expect(within(tablaTramo).getByText("Persona Endeudada")).toBeInTheDocument());

    await userEvent.selectOptions(
      screen.getByLabelText(/filtrar por tramo de antigüedad/i),
      "fuera_ventana",
    );

    await waitFor(() => {
      const llamadas = vi
        .mocked(apiFetch)
        .mock.calls.filter(([path]) => (path as string).startsWith("/api/banco-de-horas?"));
      const ultima = llamadas.at(-1)![0] as string;
      expect(ultima).toContain("tramo_antiguedad=fuera_ventana");
      expect(ultima).toContain("desplazamiento=0");
    });
  });

  it("escribir en el buscador manda busqueda_persona en la query tras el debounce", async () => {
    mockApiFetch();

    render(<BancoDeHorasPage />);
    const tablaBusqueda = await screen.findByRole("table");
    await waitFor(() =>
      expect(within(tablaBusqueda).getByText("Persona Endeudada")).toBeInTheDocument(),
    );

    vi.useFakeTimers({ shouldAdvanceTime: true });
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await usuario.type(screen.getByLabelText(/buscar por nombre/i), "ana");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    await vi.waitFor(() => {
      const llamadas = vi
        .mocked(apiFetch)
        .mock.calls.filter(([path]) => (path as string).startsWith("/api/banco-de-horas?"));
      expect(llamadas.at(-1)![0]).toContain("busqueda_persona=ana");
    });
  });

  it("paginación: Siguiente manda desplazamiento= y respeta los bordes", async () => {
    mockApiFetch({
      banco: new Response(
        JSON.stringify({
          total: 25,
          resumen: RESUMEN,
          saldos: Array.from({ length: 20 }, (_, i) => ({ ...SALDO_ENDEUDADO, persona_id: `p-${i}` })),
        }),
      ),
    });

    render(<BancoDeHorasPage />);
    await waitFor(() => expect(screen.getByText("Página 1")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /^anterior$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^siguiente$/i })).toBeEnabled();

    await userEvent.click(screen.getByRole("button", { name: /^siguiente$/i }));

    await waitFor(() => {
      const llamadas = vi
        .mocked(apiFetch)
        .mock.calls.filter(([path]) => (path as string).startsWith("/api/banco-de-horas?"));
      expect(llamadas.at(-1)![0]).toContain("desplazamiento=20");
    });
  });

  it("celda de horas fuera de ventana muestra badge peligro sólo si > 0", async () => {
    const conFueraVentana = { ...SALDO_ENDEUDADO, horas_fuera_ventana: 3.0 };
    mockApiFetch({
      banco: new Response(
        JSON.stringify({ total: 1, resumen: RESUMEN, saldos: [conFueraVentana, SALDO_AL_CORRIENTE] }),
      ),
    });

    render(<BancoDeHorasPage />);
    const tabla = await screen.findByRole("table");
    const filaConDeuda = await waitFor(() =>
      within(tabla).getByRole("row", { name: /persona endeudada/i }),
    );
    expect(within(filaConDeuda).getByText("3.00 h")).toBeInTheDocument();

    const filaAlCorriente = within(tabla).getByRole("row", { name: /persona al corriente/i });
    const celdaFueraVentana = within(filaAlCorriente).getAllByRole("cell")[4];
    expect(celdaFueraVentana).toHaveTextContent("—");
  });

  it("conciliado=false muestra el badge de aproximado", async () => {
    const sinConciliar = { ...SALDO_ENDEUDADO, conciliado: false };
    mockApiFetch({
      banco: new Response(
        JSON.stringify({ total: 1, resumen: RESUMEN, saldos: [sinConciliar, SALDO_AL_CORRIENTE] }),
      ),
    });

    render(<BancoDeHorasPage />);
    const tabla = await screen.findByRole("table");
    const fila = await waitFor(() => within(tabla).getByRole("row", { name: /persona endeudada/i }));
    expect(within(fila).getByText("Aproximado")).toBeInTheDocument();

    const filaOk = within(tabla).getByRole("row", { name: /persona al corriente/i });
    expect(within(filaOk).queryByText("Aproximado")).not.toBeInTheDocument();
  });

  it("fila expandible pide el ledger y lo cachea (no refetch al reabrir)", async () => {
    let llamadasMovimientos = 0;
    vi.mocked(apiFetch).mockImplementation((path: string) => {
      if (path === "/api/sesion") {
        return Promise.resolve(
          new Response(JSON.stringify({ acceso_permitido: true, motivo_bloqueo: null })),
        );
      }
      if (path.startsWith("/api/banco-de-horas?")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ total: 2, resumen: RESUMEN, saldos: [SALDO_ENDEUDADO, SALDO_AL_CORRIENTE] }),
          ),
        );
      }
      if (path === "/api/banco-de-horas/persona-1/movimientos") {
        llamadasMovimientos += 1;
        return Promise.resolve(new Response(JSON.stringify({ total: 2, movimientos: MOVIMIENTOS })));
      }
      return Promise.reject(new Error(`ruta no mockeada: ${path}`));
    });

    render(<BancoDeHorasPage />);
    const tabla = await screen.findByRole("table");
    const fila = await waitFor(() => within(tabla).getByRole("row", { name: /persona endeudada/i }));

    await userEvent.click(fila);
    await waitFor(() => expect(screen.getByText("cubrió falta")).toBeInTheDocument());
    expect(screen.getByText("Vigente")).toBeInTheDocument();
    expect(screen.getByText("Consumido")).toBeInTheDocument();
    expect(screen.getAllByText("Sistema")).toHaveLength(2);

    // colapsar
    await userEvent.click(fila);
    expect(screen.queryByText("cubrió falta")).not.toBeInTheDocument();

    // reabrir no refetchea
    await userEvent.click(fila);
    await waitFor(() => expect(screen.getByText("cubrió falta")).toBeInTheDocument());
    expect(llamadasMovimientos).toBe(1);
  });

  it("muestra estado vacío cuando la búsqueda no coincide con nadie", async () => {
    mockApiFetch({
      banco: new Response(JSON.stringify({ total: 0, resumen: RESUMEN, saldos: [] })),
    });

    render(<BancoDeHorasPage />);

    await waitFor(() =>
      expect(screen.getByText(/no hay saldos que coincidan con la búsqueda/i)).toBeInTheDocument(),
    );
  });

  it("muestra el estado de error con Reintentar", async () => {
    mockApiFetch({ banco: new Response(null, { status: 500 }) });

    render(<BancoDeHorasPage />);

    await waitFor(() =>
      expect(screen.getByText(/no se pudo cargar el banco de horas/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();
  });
});

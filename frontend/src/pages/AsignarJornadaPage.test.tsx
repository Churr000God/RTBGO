import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "../lib/apiClient";
import { AsignarJornadaPage } from "./AsignarJornadaPage";

vi.mock("../lib/apiClient", () => ({ apiFetch: vi.fn() }));
vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

const PERSONAS_ACTIVAS = [
  { id: "persona-ficticia-1", primer_nombre: "Persona", apellido_paterno: "Ficticia Uno", estado: "activo" },
];

function mockApiFetch(opciones: {
  sesion?: Response;
  post?: Response | Response[];
}) {
  let llamadaPost = 0;
  vi.mocked(apiFetch).mockImplementation((path: string, init?: RequestInit) => {
    if (path === "/api/sesion") {
      return Promise.resolve(
        opciones.sesion ??
          new Response(JSON.stringify({ acceso_permitido: true, motivo_bloqueo: null })),
      );
    }
    if (path === "/api/personas") {
      return Promise.resolve(new Response(JSON.stringify(PERSONAS_ACTIVAS)));
    }
    if (path === "/api/jornadas-asignadas" && init?.method === "POST") {
      if (Array.isArray(opciones.post)) {
        const respuesta = opciones.post[Math.min(llamadaPost, opciones.post.length - 1)];
        llamadaPost += 1;
        return Promise.resolve(respuesta);
      }
      return Promise.resolve(opciones.post ?? new Response(JSON.stringify({ id: 1 }), { status: 201 }));
    }
    return Promise.reject(new Error(`ruta no mockeada: ${path}`));
  });
}

async function llenarFormularioBasico() {
  await userEvent.selectOptions(await screen.findByLabelText(/^persona$/i), "persona-ficticia-1");
  await userEvent.type(screen.getByLabelText(/vigente desde/i), "2026-01-01");
  await userEvent.click(screen.getByRole("checkbox", { name: /lunes/i }));
  await userEvent.type(screen.getByLabelText(/hora de entrada/i), "09:00");
  await userEvent.type(screen.getByLabelText(/hora de salida/i), "18:00");
}

describe("AsignarJornadaPage", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it("envía persona, jornada y patrón semanal a POST /api/jornadas-asignadas", async () => {
    mockApiFetch({});

    render(<AsignarJornadaPage />);
    await llenarFormularioBasico();
    await userEvent.click(screen.getByRole("button", { name: /registrar/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/jornadas-asignadas",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const llamada = vi
      .mocked(apiFetch)
      .mock.calls.find(([path, init]) => path === "/api/jornadas-asignadas" && (init as RequestInit)?.method === "POST")!;
    const cuerpo = JSON.parse(llamada[1]!.body as string);
    expect(cuerpo.persona_id).toBe("persona-ficticia-1");
    expect(cuerpo.tipo_jornada).toBe("normal");
    expect(cuerpo.vigente_desde).toBe("2026-01-01");
    expect(cuerpo.patron_semanal).toEqual([
      { dia_semana: "lunes", hora_entrada: "09:00", hora_salida: "18:00", minutos_comida: 0 },
    ]);
    expect(cuerpo.confirma_cierre_vigente).toBeUndefined();
  });

  it("muestra el diálogo de confirmación en 409 (SCJ01) y reintenta con confirma_cierre_vigente:true", async () => {
    mockApiFetch({
      post: [
        new Response(null, { status: 409 }),
        new Response(JSON.stringify({ id: 1 }), { status: 201 }),
      ],
    });

    render(<AsignarJornadaPage />);
    await llenarFormularioBasico();
    await userEvent.click(screen.getByRole("button", { name: /registrar/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/ya tiene una jornada vigente/i),
    );

    await userEvent.click(screen.getByRole("button", { name: /sí, cerrar la anterior y asignar/i }));

    await waitFor(() => {
      const llamadas = vi
        .mocked(apiFetch)
        .mock.calls.filter(
          ([path, init]) => path === "/api/jornadas-asignadas" && (init as RequestInit)?.method === "POST",
        );
      expect(llamadas).toHaveLength(2);
      const segundoCuerpo = JSON.parse(llamadas[1][1]!.body as string);
      expect(segundoCuerpo.confirma_cierre_vigente).toBe(true);
    });
  });

  it("muestra un error legible cuando el backend rechaza el horario (422)", async () => {
    mockApiFetch({
      post: new Response(
        JSON.stringify({
          detail: [{ loc: ["body", "patron_semanal", 0], msg: "hora_salida debe ser posterior a hora_entrada" }],
        }),
        { status: 422 },
      ),
    });

    render(<AsignarJornadaPage />);
    await llenarFormularioBasico();
    await userEvent.click(screen.getByRole("button", { name: /registrar/i }));

    await waitFor(() =>
      expect(screen.getByText(/no se pudo registrar la asignación de jornada/i)).toBeInTheDocument(),
    );
  });

  it("oculta el grupo Jornadas del sidebar cuando puede_ver_modulo_3 es false", async () => {
    mockApiFetch({
      sesion: new Response(
        JSON.stringify({
          acceso_permitido: true,
          motivo_bloqueo: null,
          puede_ver_modulo_1: true,
          puede_ver_modulo_2: true,
          puede_ver_modulo_3: false,
        }),
      ),
    });

    render(<AsignarJornadaPage />);

    await waitFor(() => expect(screen.getByLabelText(/^persona$/i)).toBeInTheDocument());
    expect(screen.queryByText(/^jornadas$/i)).not.toBeInTheDocument();
  });

  it("muestra el grupo Jornadas del sidebar cuando puede_ver_modulo_3 es true", async () => {
    mockApiFetch({
      sesion: new Response(
        JSON.stringify({
          acceso_permitido: true,
          motivo_bloqueo: null,
          puede_ver_modulo_1: true,
          puede_ver_modulo_2: true,
          puede_ver_modulo_3: true,
        }),
      ),
    });

    render(<AsignarJornadaPage />);

    await waitFor(() => expect(screen.getByText(/^jornadas$/i)).toBeInTheDocument());
  });
});

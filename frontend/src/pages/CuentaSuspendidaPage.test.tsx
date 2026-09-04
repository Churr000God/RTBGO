import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CuentaSuspendidaPage } from "./CuentaSuspendidaPage";

describe("CuentaSuspendidaPage", () => {
  afterEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("muestra el copy de suspensión por defecto (sin ?motivo=)", () => {
    render(<CuentaSuspendidaPage />);

    expect(screen.getByText("Tu cuenta no está activa")).toBeInTheDocument();
    expect(screen.getByText(/reactivación sólo la puede realizar/i)).toBeInTheDocument();
  });

  it("muestra el copy de baja definitiva con ?motivo=baja_definitiva", () => {
    window.history.pushState({}, "", "/cuenta-suspendida?motivo=baja_definitiva");

    render(<CuentaSuspendidaPage />);

    expect(screen.getByText("Tu cuenta fue dada de baja")).toBeInTheDocument();
  });

  it("muestra el copy de perfil no encontrado con ?motivo=sin_persona", () => {
    window.history.pushState({}, "", "/cuenta-suspendida?motivo=sin_persona");

    render(<CuentaSuspendidaPage />);

    expect(screen.getByText("No pudimos verificar tu perfil")).toBeInTheDocument();
  });

  it("muestra el copy de perfil no encontrado con ?motivo=sin_usuario", () => {
    window.history.pushState({}, "", "/cuenta-suspendida?motivo=sin_usuario");

    render(<CuentaSuspendidaPage />);

    expect(screen.getByText("No pudimos verificar tu perfil")).toBeInTheDocument();
  });

  it("un motivo desconocido cae al copy de suspensión por defecto", () => {
    window.history.pushState({}, "", "/cuenta-suspendida?motivo=algo-inventado");

    render(<CuentaSuspendidaPage />);

    expect(screen.getByText("Tu cuenta no está activa")).toBeInTheDocument();
  });

  it("siempre muestra los datos de contacto de RH", () => {
    render(<CuentaSuspendidaPage />);

    expect(screen.getByText("rh@distribuidoracentral.mx")).toBeInTheDocument();
    expect(screen.getByText(/no permite reintentar el inicio de sesión/i)).toBeInTheDocument();
  });
});

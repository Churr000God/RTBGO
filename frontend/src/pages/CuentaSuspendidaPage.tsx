import { AuthLayout } from "../layouts/AuthLayout";

export function CuentaSuspendidaPage() {
  return (
    <AuthLayout titulo="Acceso no disponible" bajada="Tu cuenta no está activa en este momento.">
      <h2>Cuenta suspendida</h2>
      <p>Contacta a Recursos Humanos para reactivar tu acceso.</p>
    </AuthLayout>
  );
}

import { RestablecerContrasenaPage } from "./RestablecerContrasenaPage";

export function CompletarInvitacionPage() {
  // Mismo formulario que restablecer contraseña — Supabase ya autenticó a la persona vía el link
  // de invitación antes de llegar aquí (mismo mecanismo, distinto punto de entrada).
  return <RestablecerContrasenaPage />;
}

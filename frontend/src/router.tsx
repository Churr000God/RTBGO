import { createBrowserRouter } from "react-router-dom";

import { AltaPersonaPage } from "./pages/AltaPersonaPage";
import { AltaUsuarioPage } from "./pages/AltaUsuarioPage";
import { CambiarEstadoPage } from "./pages/CambiarEstadoPage";
import { CompletarInvitacionPage } from "./pages/CompletarInvitacionPage";
import { Configurar2FAPage } from "./pages/Configurar2FAPage";
import { CuentaSuspendidaPage } from "./pages/CuentaSuspendidaPage";
import { DirectorioPersonasPage } from "./pages/DirectorioPersonasPage";
import { FichaPersonaPage } from "./pages/FichaPersonaPage";
import { LoginPage } from "./pages/LoginPage";
import { OlvideContrasenaPage } from "./pages/OlvideContrasenaPage";
import { RestablecerContrasenaPage } from "./pages/RestablecerContrasenaPage";
import { VerificarTotpRoute } from "./pages/VerificarTotpRoute";

export const router = createBrowserRouter([
  { path: "/", element: <LoginPage /> },
  { path: "/cuenta-suspendida", element: <CuentaSuspendidaPage /> },
  { path: "/configurar-2fa", element: <Configurar2FAPage /> },
  { path: "/verificar-totp", element: <VerificarTotpRoute /> },
  { path: "/olvide-contrasena", element: <OlvideContrasenaPage /> },
  { path: "/restablecer-contrasena", element: <RestablecerContrasenaPage /> },
  { path: "/completar-invitacion", element: <CompletarInvitacionPage /> },
  { path: "/personas", element: <DirectorioPersonasPage /> },
  { path: "/personas/nueva", element: <AltaPersonaPage /> },
  { path: "/personas/:id", element: <FichaPersonaPage /> },
  { path: "/personas/:id/movimiento", element: <CambiarEstadoPage /> },
  { path: "/usuarios/nuevo", element: <AltaUsuarioPage /> },
]);

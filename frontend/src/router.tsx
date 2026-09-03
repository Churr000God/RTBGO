import { createBrowserRouter } from "react-router-dom";

import { CompletarInvitacionPage } from "./pages/CompletarInvitacionPage";
import { Configurar2FAPage } from "./pages/Configurar2FAPage";
import { CuentaSuspendidaPage } from "./pages/CuentaSuspendidaPage";
import { LoginPage } from "./pages/LoginPage";
import { OlvideContrasenaPage } from "./pages/OlvideContrasenaPage";
import { RestablecerContrasenaPage } from "./pages/RestablecerContrasenaPage";

export const router = createBrowserRouter([
  { path: "/", element: <LoginPage /> },
  { path: "/cuenta-suspendida", element: <CuentaSuspendidaPage /> },
  { path: "/configurar-2fa", element: <Configurar2FAPage /> },
  { path: "/olvide-contrasena", element: <OlvideContrasenaPage /> },
  { path: "/restablecer-contrasena", element: <RestablecerContrasenaPage /> },
  { path: "/completar-invitacion", element: <CompletarInvitacionPage /> },
]);

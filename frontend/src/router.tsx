import { createBrowserRouter } from "react-router-dom";

import { AltaAreaPage } from "./pages/AltaAreaPage";
import { AltaPersonaPage } from "./pages/AltaPersonaPage";
import { AltaUsuarioPage } from "./pages/AltaUsuarioPage";
import { BitacoraMovimientosPage } from "./pages/BitacoraMovimientosPage";
import { CambiarEstadoPage } from "./pages/CambiarEstadoPage";
import { CompletarInvitacionPage } from "./pages/CompletarInvitacionPage";
import { Configurar2FAPage } from "./pages/Configurar2FAPage";
import { CuentaSuspendidaPage } from "./pages/CuentaSuspendidaPage";
import { DirectorioAreasPage } from "./pages/DirectorioAreasPage";
import { DirectorioPersonasPage } from "./pages/DirectorioPersonasPage";
import { FichaAreaPage } from "./pages/FichaAreaPage";
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
  { path: "/personas/:id/bitacora", element: <BitacoraMovimientosPage /> },
  { path: "/usuarios/nuevo", element: <AltaUsuarioPage /> },
  { path: "/estructura/areas", element: <DirectorioAreasPage /> },
  { path: "/estructura/areas/nueva", element: <AltaAreaPage /> },
  { path: "/estructura/areas/:id", element: <FichaAreaPage /> },
]);

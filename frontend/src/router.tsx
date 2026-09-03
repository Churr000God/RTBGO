import { createBrowserRouter } from "react-router-dom";

import { Configurar2FAPage } from "./pages/Configurar2FAPage";
import { CuentaSuspendidaPage } from "./pages/CuentaSuspendidaPage";
import { LoginPage } from "./pages/LoginPage";

export const router = createBrowserRouter([
  { path: "/", element: <LoginPage /> },
  { path: "/cuenta-suspendida", element: <CuentaSuspendidaPage /> },
  { path: "/configurar-2fa", element: <Configurar2FAPage /> },
]);

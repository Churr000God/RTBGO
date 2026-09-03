import { createBrowserRouter } from "react-router-dom";

import { CuentaSuspendidaPage } from "./pages/CuentaSuspendidaPage";
import { LoginPage } from "./pages/LoginPage";

export const router = createBrowserRouter([
  { path: "/", element: <LoginPage /> },
  { path: "/cuenta-suspendida", element: <CuentaSuspendidaPage /> },
]);

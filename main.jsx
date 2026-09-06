import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import AdminPanel from "./AdminPanel.jsx";
import AdminApp from "./components/admin/AdminApp.jsx";

// Orden importante: los tokens deben cargarse antes que cualquier hoja que
// los consuma, y ui.css antes de los estilos heredados para que estos puedan
// seguir sobrescribiendo lo que aún no se ha migrado.
import "./styles/tokens.css";
import "./components/ui/ui.css";
import "./index.css";
import "./components/admin/admin.css";

import { UIProvider } from "./components/ui/UIProvider.jsx";

// ?admin=1       → panel nuevo, con identidad real (Supabase Auth + admin_users)
// ?admin=legacy  → panel antiguo con ADMIN_SECRET. Se conserva como red de
//                  seguridad hasta validar el nuevo en producción; se retirará
//                  junto con api/list-docentes.js.
const modoAdmin = new URLSearchParams(window.location.search).get("admin");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <UIProvider>
      {modoAdmin === "1" ? <AdminApp />
        : modoAdmin === "legacy" ? <AdminPanel />
        : <App />}
    </UIProvider>
  </React.StrictMode>
);

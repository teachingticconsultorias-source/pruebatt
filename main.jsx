import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import AdminPanel from "./AdminPanel.jsx";

// Orden importante: los tokens deben cargarse antes que cualquier hoja que
// los consuma, y ui.css antes de los estilos heredados para que estos puedan
// seguir sobrescribiendo lo que aún no se ha migrado.
import "./styles/tokens.css";
import "./components/ui/ui.css";
import "./index.css";

import { UIProvider } from "./components/ui/UIProvider.jsx";

const isAdmin = new URLSearchParams(window.location.search).get("admin") === "1";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <UIProvider>{isAdmin ? <AdminPanel /> : <App />}</UIProvider>
  </React.StrictMode>
);

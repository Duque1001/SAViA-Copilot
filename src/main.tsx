// IMPORTS PRINCIPALES

// React (necesario para renderizado)
import React from "react";

// ReactDOM para montar la app en el DOM
import ReactDOM from "react-dom/client";

// MSAL (Microsoft Entra ID)
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";

// Componente raíz de la aplicación
import App from "./App";

// Configuración de autenticación MSAL
import { msalConfig } from "./config/authConfig";

// Estilos globales
import "./index.css";

// Inicialización de internacionalización (i18n)
import "./i18n";


// CONFIGURACIÓN MSAL

// Crea la instancia de autenticación usando la configuración definida
const msalInstance = new PublicClientApplication(msalConfig);



// RENDER DE LA APLICACIÓN

ReactDOM.createRoot(document.getElementById("root")!).render(

  <React.StrictMode>
    {/* 
      Modo estricto de React:
      - Detecta problemas potenciales
      - Solo afecta desarrollo (no producción)
    */}

    <MsalProvider instance={msalInstance}>
      {/* 
        Proveedor global de autenticación:
        Permite usar MSAL en toda la app (login, logout, tokens)
      */}

      <App />
      {/* Componente principal */}

    </MsalProvider>

  </React.StrictMode>
);
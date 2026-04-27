/* eslint-disable @typescript-eslint/no-explicit-any */
// Hooks de React para estado, memoización y efectos
import { useEffect, useMemo, useState } from "react";

// Hook de MSAL para manejar autenticación
import { useMsal } from "@azure/msal-react";

// Configuración de login (scopes, etc.)
import { loginRequest } from "../config/authConfig";

// Funciones de sesión (tokens y almacenamiento local)
import {
  setIdToken,
  acquireAccessToken,
  saveSession,
} from "../config/session";

// Estilos, logo y traducciones
import "../styles/Login.css";
import saviaLogo from "../assets/images/savia-logo_.png";
import { useTranslation } from "react-i18next";

export default function Login() {
  // Traducciones y control de idioma
  const { t, i18n } = useTranslation(["login"]);

  // Instancia de MSAL (login, logout, tokens)
  const { instance } = useMsal();

  // Estados de error y validación
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [validating, setValidating] = useState<boolean>(false);

  // Agrega clase CSS al body mientras está en login
  useEffect(() => {
    document.body.classList.add("login-page");

    return () => {
      document.body.classList.remove("login-page");
    };
  }, []);

  // Detecta idioma actual (es/en)
  const currentLang = useMemo(() => {
    const lng = i18n.resolvedLanguage || i18n.language || "es";
    return lng.split("-")[0];
  }, [i18n.language, i18n.resolvedLanguage]);

  // Cambia idioma y lo guarda en localStorage
  const handleChangeLanguage = async (lng: "es" | "en") => {
    await i18n.changeLanguage(lng);
    localStorage.setItem("lang", lng);
    document.documentElement.lang = lng;
  };

  // Maneja el login con Microsoft
  const handleLogin = async () => {
    try {
      // Limpia estados previos
      setErrorMsg("");
      setValidating(false);

      // Abre popup de login
      const res = await instance.loginPopup(loginRequest);

      // Obtiene idToken y usuario
      const idToken: string = (res as any)?.idToken || "";
      const username = res.account?.username || "usuario";

      // Guarda sesión básica
      saveSession("", username);
      setIdToken(idToken);

      // Obtiene access token si aplica
      if (res.account) {
        await acquireAccessToken(instance, res.account).catch(console.error);
      }

      // Estado breve de validación / carga
      setValidating(true);

      // Login exitoso → redirige a la app
      window.location.replace("/");
    } catch (error: any) {
      setValidating(false);

      // Ignora cancelación del usuario
      if (
        error?.errorCode === "user_cancelled" ||
        error?.errorCode === "popup_window_error"
      ) {
        return;
      }

      console.error("Error en login:", error);

      // Muestra error genérico
      setErrorMsg(t("alertUnexpected"));
    }
  };

  return (
    <div className="login-fullscreen">
      <div className="login-container">
        <div className="login-card" role="region" aria-label="Login">
          {/* Logo y descripción */}
          <img src={saviaLogo} alt="Savia Logo" className="login-logo" />
          <p>{t("tagline")}</p>

          {/* Estado: validando */}
          {validating ? (
            <div className="login-alert" role="status" aria-live="polite">
              <p>{t("validating") || "Validando sesión..."}</p>
            </div>
          ) : errorMsg ? (
            // Estado: error
            <div
              className="login-alert login-alert--error"
              role="alert"
              aria-live="polite"
            >
              <strong>{t("alertTransientTitle")}</strong>
              <div style={{ marginTop: 6 }}>{errorMsg}</div>
            </div>
          ) : (
            /* Estado: botón de login */
            <button className="btn-login" onClick={handleLogin}>
              {t("signIn")}
            </button>
          )}

          {/* Selector de idioma */}
          <div className="lang-switch">
            <label className="lang-switch__label">{t("languageLabel")}</label>
            <select
              className="lang-switch__select"
              value={currentLang === "en" ? "en" : "es"}
              onChange={(e) =>
                handleChangeLanguage(e.target.value as "es" | "en")
              }
            >
              <option value="es">{t("spanish")}</option>
              <option value="en">{t("english")}</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
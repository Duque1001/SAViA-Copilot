import { useEffect, useMemo, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../config/authConfig";
import {
  setIdToken,
  validateIdTokenExternal,
  acquireAccessToken,
  clearSession,
  saveSession,
} from "../config/session";
import "../styles/Login.css";
import saviaLogo from "../assets/images/savia-logo_.png";

import { useTranslation } from "react-i18next";

type ValidationErrorType = "denied" | "transient" | null;

export default function Login() {
  const { t, i18n } = useTranslation(["login"]);
  const { instance } = useMsal();

  useEffect(() => {
    document.body.classList.add("login-page");
    return () => document.body.classList.remove("login-page");
  }, []);

  const [errorType, setErrorType] = useState<ValidationErrorType>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Normaliza "en-US" -> "en"
  const currentLang = useMemo(() => {
    const lng = i18n.resolvedLanguage || i18n.language || "es";
    return lng.split("-")[0];
  }, [i18n.language, i18n.resolvedLanguage]);

  const handleChangeLanguage = async (lng: "es" | "en") => {
    await i18n.changeLanguage(lng);

    localStorage.setItem("lang", lng);
    document.documentElement.lang = lng;
  };

  const handleLogin = async () => {
    try {
      const res = await instance.loginPopup(loginRequest);

      const idToken: string = (res as any)?.idToken || "";
      const username = res.account?.username || "usuario";

      saveSession("", username);
      setIdToken(idToken);

      const validation = await validateIdTokenExternal(idToken);

      if (!validation.ok) {
        if (validation.denied) {
          setErrorType("denied");
          setErrorMsg(t("alertDeniedMsg"));
        } else {
          setErrorType("transient");
          setErrorMsg(t("alertTransientMsg"));
        }
        return;
      }

      await new Promise((r) => setTimeout(r, 150));
      await acquireAccessToken(instance, res.account!);

      window.location.replace("/");
    } catch (error) {
      console.error("Error en login:", error);
      setErrorType("transient");
      setErrorMsg(t("alertUnexpected"));
    }
  };

  const handleRetryValidation = async () => {
    setErrorType(null);
    setErrorMsg("");
    await handleLogin();
  };

  const handleLogout = async () => {
    try {
      clearSession();
      await instance.logoutPopup();
    } catch (e) {
      console.warn("Error cerrando sesión:", e);
    }
  };

  return (
    <div className="login-fullscreen">
      <div className="login-container">
        <div className="login-card" role="region" aria-label="Login">
          <img src={saviaLogo} alt="Savia Logo" className="logo" />
          <p>{t("tagline")}</p>

          {errorType ? (
            <div
              className={`login-alert ${
                errorType === "denied" ? "login-alert--error" : "login-alert--warn"
              }`}
              role="alert"
              aria-live="polite"
            >
              <strong>
                {errorType === "denied" ? t("alertDeniedTitle") : t("alertTransientTitle")}
              </strong>
              <div style={{ marginTop: 6 }}>{errorMsg}</div>

              <div className="login-alert__actions">
                {errorType === "transient" && (
                  <button className="btn-retry" onClick={handleRetryValidation}>
                    {t("retry")}
                  </button>
                )}
                <button className="btn-logout" onClick={handleLogout}>
                  {t("logout")}
                </button>
              </div>
            </div>
          ) : (
            <button className="btn-login" onClick={handleLogin}>
              {t("signIn")}
            </button>
          )}

          {/* Selector abajo a la derecha */}
          <div className="lang-switch">
            <label className="lang-switch__label">{t("languageLabel")}</label>
            <select
              className="lang-switch__select"
              value={currentLang === "en" ? "en" : "es"}
              onChange={(e) => handleChangeLanguage(e.target.value as "es" | "en")}
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
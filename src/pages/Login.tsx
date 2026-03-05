import { useEffect, useMemo, useState, useRef } from "react";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../config/authConfig";
import {
    setIdToken,
    acquireAccessToken,
    clearSession,
    saveSession,
    validateTokenDetailed,
} from "../config/session";
import "../styles/Login.css";
import saviaLogo from "../assets/images/savia-logo_.png";
import { useTranslation } from "react-i18next";

const AUTO_LOGOUT_MS = 3500; // tiempo para mostrar el mensaje antes de cerrar sesión (0 = deshabilitar)

export default function Login() {
    const { t, i18n } = useTranslation(["login"]);
    const { instance } = useMsal();

    useEffect(() => {
        document.body.classList.add("login-page");
        return () => document.body.classList.remove("login-page");
    }, []);

    const [errorMsg, setErrorMsg] = useState<string>("");
    const [validating, setValidating] = useState<boolean>(false);
    const logoutTimer = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (logoutTimer.current) window.clearTimeout(logoutTimer.current);
        };
    }, []);

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
            setErrorMsg("");
            setValidating(false);

            // 1) Login con Microsoft Entra ID
            const res = await instance.loginPopup(loginRequest);

            // 2) Guardar sesión básica
            const idToken: string = (res as any)?.idToken || "";
            const username = res.account?.username || "usuario";
            saveSession("", username);
            setIdToken(idToken);

            // 3) (Opcional) Access token
            if (res.account) {
                await acquireAccessToken(instance, res.account).catch(console.error);
            }

            // 4) Validación externa (NO cierra aquí; devuelve {ok, reason})
            setValidating(true);
            const result = await validateTokenDetailed(idToken);
            setValidating(false);

            if (!result.ok) {
                // Mostrar mensaje y (opcional) auto‑logout después de un tiempo
                setErrorMsg(result.reason || t("alertUnexpected"));

                if (AUTO_LOGOUT_MS > 0) {
                    logoutTimer.current = window.setTimeout(async () => {
                        try { clearSession(); } catch { }
                        try { await instance.logoutPopup(); } catch { }
                    }, AUTO_LOGOUT_MS);
                }
                return;
            }

            // 5) Token válido → entrar a la app
            window.location.replace("/");
        } catch (error: any) {
            setValidating(false);

            if (error?.errorCode === "user_cancelled" || error?.errorCode === "popup_window_error") {
                return;
            }

            console.error("Error en login:", error);
            setErrorMsg(t("alertUnexpected"));
        }
    };

    const handleLogoutNow = async () => {
        if (logoutTimer.current) {
            window.clearTimeout(logoutTimer.current);
            logoutTimer.current = null;
        }
        try { clearSession(); } catch { }
        try { await instance.logoutPopup(); } catch { }
    };

    return (
        <div className="login-fullscreen">
            <div className="login-container">
                <div className="login-card" role="region" aria-label="Login">
                    <img src={saviaLogo} alt="Savia Logo" className="logo" />
                    <p>{t("tagline")}</p>

                    {validating ? (
                        <div className="login-alert" role="status" aria-live="polite">
                            <p>{t("validating") || "Validando sesión..."}</p>
                        </div>
                    ) : errorMsg ? (
                        <div className="login-alert login-alert--error" role="alert" aria-live="polite">
                            <strong>{t("alertTransientTitle")}</strong>
                            <div style={{ marginTop: 6 }}>{errorMsg}</div>
                            <div className="login-alert__actions" style={{ marginTop: 10 }}>
                                <button className="btn-logout" onClick={handleLogoutNow}>
                                    {t("logout") || "Cerrar sesión"}
                                </button>
                            </div>
                            {AUTO_LOGOUT_MS > 0 && (
                                <div style={{ marginTop: 8, fontSize: 12, opacity: .8 }}>
                                    Se cerrará la sesión automáticamente en {Math.round(AUTO_LOGOUT_MS / 1000)}s…
                                </div>
                            )}
                        </div>
                    ) : (
                        <button className="btn-login" onClick={handleLogin}>
                            {t("signIn")}
                        </button>
                    )}

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
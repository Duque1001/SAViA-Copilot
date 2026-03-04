import { useEffect, useMemo, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../config/authConfig";
import {
    setIdToken,
    acquireAccessToken,
    clearSession,
    saveSession,
    validateToken,
} from "../config/session";
import "../styles/Login.css";
import saviaLogo from "../assets/images/savia-logo_.png";
import { useTranslation } from "react-i18next";

export default function Login() {
    const { t, i18n } = useTranslation(["login"]);
    const { instance } = useMsal();

    useEffect(() => {
        document.body.classList.add("login-page");
        return () => document.body.classList.remove("login-page");
    }, []);

    const [errorMsg, setErrorMsg] = useState<string>("");
    const [validating, setValidating] = useState<boolean>(false);

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

            // 3) Obtener access token (opcional)
            if (res.account) {
                await acquireAccessToken(instance, res.account).catch(console.error);
            }

            // 4) Validar token con API externa
            setValidating(true);
            const tokenData = await validateToken(idToken);
            setValidating(false);

            if (!tokenData) {
                // ⚠️ NO llamamos logoutPopup() — solo limpiamos sesión local
                // Esto evita que MSAL cierre la sesión y cause el loop
                clearSession();
                setErrorMsg(t("alertUnexpected"));
                return;
            }

            // 5) Token válido → entrar a la app
            window.location.replace("/");

        } catch (error: any) {
            setValidating(false);

            // Ignorar cancelación del popup (usuario cerró la ventana)
            if (error?.errorCode === "user_cancelled" || error?.errorCode === "popup_window_error") {
                return;
            }

            console.error("Error en login:", error);
            setErrorMsg(t("alertUnexpected"));
        }
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

                    {validating ? (
                        <div className="login-alert" role="status" aria-live="polite">
                            <p>{t("validating") || "Validando sesión..."}</p>
                        </div>
                    ) : errorMsg ? (
                        <div className="login-alert login-alert--warn" role="alert" aria-live="polite">
                            <strong>{t("alertTransientTitle")}</strong>
                            <div style={{ marginTop: 6 }}>{errorMsg}</div>
                            <div className="login-alert__actions">
                                <button className="btn-retry" onClick={handleLogin}>
                                    {t("retry")}
                                </button>
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
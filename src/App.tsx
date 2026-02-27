import { useEffect, useState } from "react";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import {
    clearSession,
    acquireAccessToken,
    getName,
    getUniqueName,
    isTokenValidated,
    getIdToken,
    validateIdTokenWithRetry,
} from "./config/session";

import ChatWindow from "./components/ChatWindow";
import ChatInput from "./components/ChatInput";
import Header from "./components/Header";
import Login from "./pages/Login";

import "./App.css";
import "./styles/Login.css";

/* 🔧 CONFIGURACIÓN */
const RAW_API_URL = import.meta.env.VITE_CHAT_API_URL;
if (!RAW_API_URL) throw new Error("VITE_CHAT_API_URL no está definida");

// 🔹 elimina SOLO el slash final si existe
const API_URL = RAW_API_URL.replace(/\/$/, "");

/* 🧠 TIPOS */
interface Message {
    from: "user" | "bot";
    text: string;
}

type GuardErrorType = "denied" | "transient" | null;

function App() {
    /* 🔐 ENTRA ID */
    const isAuthenticated = useIsAuthenticated();
    const { instance, accounts } = useMsal();

    /* 👤 EMAIL DEL USUARIO */
    const email = accounts.length > 0 ? accounts[0].username : "";

    /* 👤 USER ID (antes del @) */
    const userId = email.includes("@") ? email.split("@")[0] : email || "Usuario";

    /* ✅ Validación previa a mostrar la App */
    const [validated, setValidated] = useState<boolean>(isTokenValidated());
    const [validating, setValidating] = useState<boolean>(!isTokenValidated());
    const [guardError, setGuardError] = useState<GuardErrorType>(null);

    const runValidation = async () => {
        if (!isAuthenticated) return;

        setGuardError(null);

        if (isTokenValidated()) {
            setValidated(true);
            setValidating(false);
            if (accounts.length > 0) acquireAccessToken(instance, accounts[0]).catch(console.error);
            return;
        }

        const idToken = getIdToken();
        if (!idToken) {
            setValidating(false);
            setValidated(false);
            setGuardError("denied");
            return;
        }

        setValidating(true);
        const val = await validateIdTokenWithRetry(idToken, 3);

        if (val.ok) {
            setValidated(true);
            setValidating(false);
            if (accounts.length > 0) acquireAccessToken(instance, accounts[0]).catch(console.error);
        } else if (val.denied) {
            // Rechazo explícito
            setValidating(false);
            setValidated(false);
            setGuardError("denied");
        } else {
            // Fallo transitorio tras agotar reintentos
            setValidating(false);
            setValidated(false);
            setGuardError("transient");
        }
    };

    useEffect(() => {
        runValidation().catch(console.error);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, accounts, instance]);

    const handleLogout = () => {
        clearSession();
        instance.logoutPopup().catch(console.error);
    };

    /* 💬 ESTADO DEL CHAT */
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);

    /* 🔌 LLAMADA A LA API (SIN TOKEN) */
    const sendMessageToApi = async (text: string) => {
        try {
            setLoading(true);

            const storedName = getName();
            const storedUnique = getUniqueName();

            const payload = {
                session_id: storedUnique || storedName || userId,
                request_id: "1",
                text,
            };

            const response = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) throw new Error("Error HTTP");

            const data = await response.json();
            return data.response;
        } catch (error) {
            console.error("🔥 Error en fetch:", error);
            return "❌ Error al conectar con el bot";
        } finally {
            setLoading(false);
        }
    };

    /* 📩 ENVÍO DE MENSAJES */
    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMessage = input;
        setInput("");

        setMessages((prev) => [
            ...prev,
            { from: "user", text: userMessage },
            { from: "bot", text: "🤖 escribiendo..." },
        ]);

        const botResponse = await sendMessageToApi(userMessage);

        setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { from: "bot", text: botResponse };
            return updated;
        });
    };

    /* 🔀 LOGIN o GUARD */
    if (!isAuthenticated) return <Login />;

    if (validating) {
        return (
            <div className="login-container" style={{ padding: 24 }}>
                <h3>Validando sesión…</h3>
                <p>Por favor espera un momento.</p>
            </div>
        );
    }

    if (!validated) {
        // Mensajes diferenciados por causa
        if (guardError === "denied") {
            return (
                <div className="login-container" style={{ padding: 24 }}>
                    <h3>Validación rechazada</h3>
                    <p>El validador externo no aprobó tu sesión. Por favor, cierra sesión e inténtalo nuevamente.</p>
                    <button onClick={handleLogout}>Cerrar sesión</button>
                </div>
            );
        }

        // transitorio (o desconocido)
        return (
            <div className="login-container" style={{ padding: 24 }}>
                <h3>No fue posible validar la sesión</h3>
                <p>Puede ser un problema temporal de red o del validador. Puedes reintentar o cerrar sesión.</p>
                <button onClick={runValidation}>Reintentar</button>
                <button onClick={handleLogout} style={{ marginLeft: 12 }}>Cerrar sesión</button>
            </div>
        );
    }

    // Datos para Header
    const displayName = getName() || getUniqueName() || userId;

    return (
        <div className="app">
            <Header
                username={userId}
                displayName={displayName}
                onLogout={handleLogout}
            />

            <ChatWindow messages={messages} />
            <ChatInput
                value={input}
                onChange={setInput}
                onSend={handleSend}
                disabled={loading}
            />
        </div>
    );
}

export default App;
import { useEffect, useState } from "react";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import {
    clearSession,
    acquireAccessToken,
} from "./config/session";

import ChatWindow from "./components/ChatWindow";
import ChatInput from "./components/ChatInput";
import Header from "./components/Header";
import Login from "./pages/Login";

import "./App.css";

/* 🔧 CONFIGURACIÓN */
//const USE_MOCK_API = false;
const API_URL = import.meta.env.VITE_CHAT_API_URL;

if (!API_URL) {
    throw new Error("VITE_CHAT_API_URL no está definida");
}

/* 🧠 TIPOS */
interface Message {
    from: "user" | "bot";
    text: string;
}

function App() {
    /* 🔐 ENTRA ID */
    const isAuthenticated = useIsAuthenticated();
    const { instance, accounts } = useMsal();

    /* 👤 EMAIL DEL USUARIO */
    const email =
        accounts.length > 0
            ? accounts[0].username
            : "";

    /* 👤 USER ID (antes del @) */
    const userId = email.includes("@")
        ? email.split("@")[0]
        : email || "Usuario";

    /* 🔑 OBTENER TOKEN (solo para sesión Entra, NO para API) */
    useEffect(() => {
        if (isAuthenticated && accounts.length > 0) {
            acquireAccessToken(instance, accounts[0]).catch(console.error);
        }
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

            const payload = {
                //session_id: userId,
                //request_id: Date.now().toString(),
                session_id: "AnderssonH",
                request_id: "1",
                text,
            };

            // 👀 LOG CLAVE
            console.group("📤 Enviando request al chatbot");
            console.log("URL:", API_URL);
            console.log("Headers:", {
                "Content-Type": "application/json",
            });
            console.log("Body:", payload);
            console.groupEnd();

            const response = await fetch(API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                console.error("❌ Status HTTP:", response.status);
                throw new Error("Error HTTP");
            }

            const data = await response.json();

            console.log("📥 Respuesta backend:", data);

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
            updated[updated.length - 1] = {
                from: "bot",
                text: botResponse,
            };
            return updated;
        });
    };

    /* 🔀 LOGIN */
    if (!isAuthenticated) {
        return <Login />;
    }

    return (
        <div className="app">
            {/* 🧠 HEADER */}
            <Header
                username={userId}   // 👈 solo lo que va antes del @
                onLogout={handleLogout}
            />

            {/* 💬 CHAT */}
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
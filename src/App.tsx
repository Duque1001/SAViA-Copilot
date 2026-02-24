import { useState } from "react";
import ChatWindow from "./components/ChatWindow";
import ChatInput from "./components/ChatInput";
import "./App.css";

/* 🔧 CONFIGURACIÓN */
const USE_MOCK_API = true;
const API_URL = "https://jsonplaceholder.typicode.com/posts";

/* 🧠 TIPOS */
interface Message {
    from: "user" | "bot";
    text: string;
}

const SESSION_KEY = "chatbot_session_id";

const getSessionId = () => {
    let sessionId = localStorage.getItem(SESSION_KEY);

    if (!sessionId) {
        sessionId = `SESSION_${Date.now()}`;
        localStorage.setItem(SESSION_KEY, sessionId);
    }

    return sessionId;
};

function App() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);

    /* 🔌 LLAMADA A LA API */
    const sendMessageToApi = async (text: string) => {
        try {
            setLoading(true);

            const response = await fetch(API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    session_id: getSessionId(),
                    request_id: Date.now().toString(),
                    text: text,
                }),
            });

            if (!response.ok) {
                throw new Error("Error HTTP");
            }

            const data = await response.json();

            // 🟡 MODO MOCK (API de prueba)
            if (USE_MOCK_API) {
                return `Echo mock: ${text}`;
            }

            // 🟢 MODO REAL (tu API)
            if (data.status !== "Succes") {
                throw new Error("Error de negocio");
            }

            return data.response;
        } catch (error) {
            console.error(error);
            return "❌ Error al conectar con el bot";
        } finally {
            setLoading(false);
        }
    };

    /* 📩 CUANDO SE ENVÍA UN MENSAJE */
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

    return (
        <div className="app">
            <h1>Chatbot Savios</h1>
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
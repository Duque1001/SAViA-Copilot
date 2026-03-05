import { useEffect, useState } from "react";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import {
    clearSession,
    acquireAccessToken,
    acquireIdToken,
    getName,
    getUniqueName,
    getIdToken,
} from "./config/session";

import ChatWindow from "./components/ChatWindow";
import ChatInput from "./components/ChatInput";
import Header from "./components/Header";
import SideNav from "./components/SideNav";
import Login from "./pages/Login";

import "./App.css";
import { useTranslation } from "react-i18next";

// CONFIGURACIÓN
const RAW_API_URL = import.meta.env.VITE_CHAT_API_URL;
if (!RAW_API_URL) throw new Error("VITE_CHAT_API_URL no está definida");
const API_URL = RAW_API_URL.replace(/\/$/, "");

// TIPOS
interface Message {
    from: "user" | "bot";
    text: string;
}
type ViewKey = "chat" | "config";

function App() {
    const { t } = useTranslation(["chat"]);

    const isAuthenticated = useIsAuthenticated();
    const { instance, accounts } = useMsal();

    const email = accounts.length > 0 ? accounts[0].username : "";
    const userId = email.includes("@") ? email.split("@")[0] : email || "Usuario";

    const [activeView, setActiveView] = useState<ViewKey>("chat");
    const [isSideOpen, setSideOpen] = useState<boolean>(false);

    // Mensajería
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const primeAuthArtifacts = async () => {
            if (!isAuthenticated || accounts.length === 0) return;
            await acquireIdToken(instance, accounts[0]).catch(console.error);
            await acquireAccessToken(instance, accounts[0]).catch(console.error);
        };
        primeAuthArtifacts().catch(console.error);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, accounts, instance]);

    const handleLogout = () => {
        clearSession();
        instance.logoutPopup().catch(console.error);
    };

    const sendMessageToApi = async (text: string) => {
        try {
            setLoading(true);

            const storedName = getName();
            const storedUnique = getUniqueName();
            const idToken = getIdToken();

            const payload = {
                session_id: storedUnique || storedName || userId,
                request_id: "1",
                text,
            };

            const response = await fetch(API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${idToken}`
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) throw new Error("Error HTTP");
            const data = await response.json();
            return data.response;
        } catch (error) {
            console.error(" Error en fetch:", error);
            return t("connectError");
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMessage = input;
        setInput("");

        setMessages((prev) => [
            ...prev,
            { from: "user", text: userMessage },
            { from: "bot", text: t("typing") },
        ]);

        const botResponse = await sendMessageToApi(userMessage);

        setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { from: "bot", text: botResponse };
            return updated;
        });
    };

    if (!isAuthenticated) return <Login />;

    const displayName = getName() || getUniqueName() || userId;

    return (
        <div className="app">
            <Header
                username={userId}
                displayName={displayName}
                onLogout={handleLogout}
                onToggleMenu={() => setSideOpen((v) => !v)}
            />

            <div className="app-shell">
                <SideNav
                    activeKey={activeView}
                    isOpen={isSideOpen}
                    onSelect={(key) => {
                        setActiveView(key);
                        setSideOpen(false);
                    }}
                    onClose={() => setSideOpen(false)}
                />

                <main className="content">
                    {activeView === "chat" ? (
                        <section className="chat-section">
                            <div className="chat-card">
                                <ChatWindow messages={messages} />
                            </div>

                            <div className="chat-input-row">
                                <ChatInput value={input} onChange={setInput} onSend={handleSend} disabled={loading} />
                            </div>
                        </section>
                    ) : (
                        <section className="placeholder">
                            <h3>{t("configTitle")}</h3>
                            <p>{t("configMsg")}</p>
                        </section>
                    )}
                </main>
            </div>
        </div>
    );
}

export default App;
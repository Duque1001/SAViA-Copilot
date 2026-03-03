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
import SideNav from "./components/SideNav";
import Login from "./pages/Login";

import "./App.css";
import { useTranslation } from "react-i18next";

// CONFIGURACIÓN
const RAW_API_URL = import.meta.env.VITE_CHAT_API_URL;
if (!RAW_API_URL) throw new Error("VITE_CHAT_API_URL no está definida");
const API_URL = RAW_API_URL.replace(/\/$/, "");

//  TIPOS
interface Message {
  from: "user" | "bot";
  text: string;
}
type GuardErrorType = "denied" | "transient" | null;
type ViewKey = "chat" | "config";

function App() {
  const { t } = useTranslation(["chat"]);

  const isAuthenticated = useIsAuthenticated();
  const { instance, accounts } = useMsal();

  const email = accounts.length > 0 ? accounts[0].username : "";
  const userId = email.includes("@") ? email.split("@")[0] : email || "Usuario";

  const [validated, setValidated] = useState<boolean>(isTokenValidated());
  const [validating, setValidating] = useState<boolean>(!isTokenValidated());
  const [guardError, setGuardError] = useState<GuardErrorType>(null);

  const [activeView, setActiveView] = useState<ViewKey>("chat");
  const [isSideOpen, setSideOpen] = useState<boolean>(false);

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
      setValidating(false);
      setValidated(false);
      setGuardError("denied");
    } else {
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

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

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

  if (validating) {
    return (
      <div className="app app--center">
        <div className="guard-card">
          <h3>{t("validatingTitle")}</h3>
          <p>{t("validatingMsg")}</p>
        </div>
      </div>
    );
  }

  if (!validated) {
    if (guardError === "denied") {
      return (
        <div className="app app--center">
          <div className="guard-card guard-card--error">
            <h3>{t("guardDeniedTitle")}</h3>
            <p>{t("guardDeniedMsg")}</p>
            <button className="btn btn--secondary" onClick={handleLogout}>
              {t("logout")}
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="app app--center">
        <div className="guard-card guard-card--warn">
          <h3>{t("guardTransientTitle")}</h3>
          <p>{t("guardTransientMsg")}</p>
          <div className="guard-actions">
            <button className="btn btn--primary" onClick={runValidation}>
              {t("retry")}
            </button>
            <button className="btn btn--secondary" onClick={handleLogout}>
              {t("logout")}
            </button>
          </div>
        </div>
      </div>
    );
  }

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


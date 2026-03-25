// IMPORTS
// Hooks de React
import { useEffect, useRef, useState } from "react";

// Hooks de autenticación con MSAL
import { useIsAuthenticated, useMsal } from "@azure/msal-react";

// Funciones de sesión y autenticación
import {
  acquireAccessToken,
  acquireIdToken,
  acquireValidIdToken,
  getName,
  getUniqueName,
  logoutAndGoHome,
} from "./config/session";

// Componentes principales
import ChatWindow from "./components/ChatWindow";
import ChatInput from "./components/ChatInput";
import Header from "./components/Header";
import SideNav from "./components/SideNav";

// Páginas
import Login from "./pages/Login";
import Landing from "./pages/Landing";

// Estilos y traducciones
import "./App.css";
import { useTranslation } from "react-i18next";



// CONFIGURACIÓN API

// URL del backend desde variables de entorno
const RAW_API_URL = import.meta.env.VITE_CHAT_API_URL;

// Valida que exista la variable
if (!RAW_API_URL) throw new Error("VITE_CHAT_API_URL no está definida");

// Elimina slash final si existe
const API_URL = RAW_API_URL.replace(/\/$/, "");

// TIPOS
// Estructura de cada mensaje
interface Message {
  id: string;
  from: "user" | "bot";
  text: string;
  isThinking?: boolean; // indica si el bot está "pensando"
  shouldAnimate?: boolean;
}

// Vistas disponibles en la app
type ViewKey = "chat" | "config";

// COMPONENTE PRINCIPAL
function App() {
  // Hook de traducción
  const { t } = useTranslation(["chat", "common"]);

  // Estado de autenticación
  const isAuthenticated = useIsAuthenticated();
  const { instance, accounts } = useMsal();

  // Email y userId derivados de la cuenta
  const email = accounts.length > 0 ? accounts[0].username : "";
  const userId = email.includes("@") ? email.split("@")[0] : email || "Usuario";

  // ESTADOS
  const [activeView, setActiveView] = useState<ViewKey>("chat"); // vista actual
  const [isSideOpen, setSideOpen] = useState(false); // controla menú lateral
  const [messages, setMessages] = useState<Message[]>([]); // mensajes del chat
  const [input, setInput] = useState(""); // texto del input
  const [loading, setLoading] = useState(false); // estado de carga
  const [landingSeen, setLandingSeen] = useState(
    () => localStorage.getItem("landingSeen") === "true"
  ); // controla si ya pasó por landing


  // CONFIGURACIÓN VISUAL
  // Carga color principal del header
  useEffect(() => {
    const savedColor = localStorage.getItem("app_primary_color");
    if (savedColor) {
      document.documentElement.style.setProperty("--clr-header", savedColor);
    }
  }, []);

  // Carga color del botón logout
  useEffect(() => {
    const savedLogoutColor = localStorage.getItem("logout_btn_color");
    if (savedLogoutColor) {
      document.documentElement.style.setProperty(
        "--clr-logout-btn",
        savedLogoutColor
      );
    }
  }, []);

  // Carga color del texto del botón logout
  useEffect(() => {
    const savedTextColor = localStorage.getItem("logout_text_color");
    if (savedTextColor) {
      document.documentElement.style.setProperty(
        "--clr-logout-text",
        savedTextColor
      );
    }
  }, []);

  // Carga colores de los botones del menú lateral
  useEffect(() => {
    const btnColor = localStorage.getItem("sidebar_btn_color");
    if (btnColor) {
      document.documentElement.style.setProperty("--clr-sidebar-btn", btnColor);
    }

    const textColor = localStorage.getItem("sidebar_text_color");
    if (textColor) {
      document.documentElement.style.setProperty("--clr-sidebar-text", textColor);
    }
  }, []);

  // CONTROL DE MENSAJES
  // Referencia para generar IDs únicos
  const messageIdRef = useRef(0);

  // Reinicia estados si se pierde autenticación
  useEffect(() => {
    if (isAuthenticated && accounts.length > 0) return;

    setMessages([]);
    setInput("");
    setLoading(false);
    messageIdRef.current = 0;
  }, [isAuthenticated, accounts.length]);

  // Genera IDs incrementales
  const createMessageId = () => {
    messageIdRef.current += 1;
    return `msg-${messageIdRef.current}`;
  };

  // AUTENTICACIÓN
  // Inicializa tokens al autenticarse
  useEffect(() => {
    const initAuth = async () => {
      if (!isAuthenticated || accounts.length === 0) return;

      await acquireIdToken(instance, accounts[0]).catch(console.error);
      await acquireAccessToken(instance, accounts[0]).catch(console.error);
    };

    initAuth();
  }, [isAuthenticated, accounts, instance]);

  // Cierra sesión y limpia estado
  const handleLogout = async () => {
    localStorage.removeItem("landingSeen");

    setMessages([]);
    setInput("");
    setLoading(false);
    messageIdRef.current = 0;

    await logoutAndGoHome(instance);
  };



  // NAVEGACIÓN 
  // Entra desde landing a la app
  const enterAppFromLanding = () => {
    localStorage.setItem("landingSeen", "true");
    setLandingSeen(true);
    setActiveView("chat");
  };

  // Regresa a la landing
  const goToLanding = () => {
    localStorage.removeItem("landingSeen");

    setSideOpen(false);
    // setMessages([]);
    // setInput("");
    // setLoading(false);
    // messageIdRef.current = 0;

    setLandingSeen(false);
    setActiveView("chat");
  };

  // LLAMADO A LA API
  const sendMessageToApi = async (text: string) => {
    try {
      setLoading(true);

      const storedName = getName();
      const storedUnique = getUniqueName();
      const account = accounts[0];

      // Si no hay cuenta, fuerza logout
      if (!account) {
        await logoutAndGoHome(instance);
        return t("connectError");
      }

      // Obtiene token válido
      const token = await acquireValidIdToken(instance, account);

      if (!token) {
        await logoutAndGoHome(instance);
        return t("connectError");
      }

      // Payload para la API
      const payload = {
        session_id: storedUnique || storedName || userId,
        request_id: "1",
        text,
      };

      // Llamado POST al backend
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      // Si hay error de sesión, logout
      if (response.status === 401 || response.status === 403) {
        await logoutAndGoHome(instance);
        return t("connectError");
      }

      // Si la respuesta no es correcta, lanza error
      if (!response.ok) {
        throw new Error(`Error HTTP ${response.status}`);
      }

      // Retorna respuesta del backend
      const data = await response.json();
      return data.response;
    } catch (error) {
      console.error("Error:", error);
      await logoutAndGoHome(instance);
      return t("connectError");
    } finally {
      setLoading(false);
    }
  };


  // ENVÍO DE MENSAJES
  const handleSend = async () => {
    // Evita enviar vacío o mientras carga
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput("");

    // IDs para mensaje usuario y placeholder bot
    const userIdMsg = createMessageId();
    const thinkingId = createMessageId();

    // Agrega mensaje usuario + mensaje temporal de "pensando"
    setMessages((prev) => [
      ...prev,
      { id: userIdMsg, from: "user", text: userText },
      { id: thinkingId, from: "bot", text: t("thinking"), isThinking: true },
    ]);

    // Llama al backend
    const response = await sendMessageToApi(userText);

    // Reemplaza el placeholder por la respuesta real
    setMessages((prev) =>
      prev.map((m) =>
        m.id === thinkingId
          ? { ...m, text: response || t("connectError"), isThinking: false, shouldAnimate: true }
          : m
      )
    );
  };


  // RENDER CONDICIONAL
  // Si no hay sesión, muestra login
  if (!isAuthenticated) return <Login />;

  // Si no ha visto landing, la muestra
  if (!landingSeen) {
    const displayName = getName() || getUniqueName() || userId;

    return (
      <Landing
        onEnterApp={enterAppFromLanding}
        onLogout={handleLogout}
        displayName={displayName}
      />
    );
  }


  // DATOS VISUALES
  const displayName = getName() || getUniqueName() || userId;

  const handleBotTypingComplete = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, shouldAnimate: false }
          : m
      )
    );
  };

  // RENDER PRINCIPAL
  return (
    <div className="app">
      {/* Header superior */}
      <Header
        username={userId}
        displayName={displayName}
        onLogout={handleLogout}
        onToggleMenu={() => setSideOpen((v) => !v)}
      />

      <div className="app-shell">
        {/* Menú lateral */}
        <SideNav
          activeKey={activeView}
          isOpen={isSideOpen}
          onSelect={(key) => {
            setActiveView(key);
            setSideOpen(false);
          }}
          onClose={() => setSideOpen(false)}
          onGoHome={goToLanding}
        />

        <main className="content">
          {activeView === "chat" ? (

            // VISTA CHAT
            <section className="chat-section">
              <div className="chat-card">
                <ChatWindow messages={messages} onBotTypingComplete={handleBotTypingComplete} />
              </div>

              <ChatInput
                value={input}
                onChange={setInput}
                onSend={handleSend}
                disabled={loading}
              />
            </section>
          ) : (

            // VISTA CONFIGURACIÓN
            <section className="config-section">
              <div className="config-card">
                <h2>Configuración</h2>

                {/* Bloque subir logo */}
                <div className="config-upload-block">
                  <h3>Cambiar logo</h3>
                  <div className="config-group">
                    <input
                      id="logoUpload"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        const reader = new FileReader();
                        reader.onloadend = () => {
                          const base64 = reader.result as string;
                          localStorage.setItem("app_logo", base64);
                          window.dispatchEvent(new Event("logoUpdated"));
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </div>
                </div>

                <div className="config-divider"></div>

                <div className="config-columns">
                  {/* Columna header */}
                  <div className="config-column">
                    <h3>Header y Chat</h3>

                    <div className="config-row">
                      <label htmlFor="primaryColor">Color principal del header</label>
                      <input
                        id="primaryColor"
                        type="color"
                        defaultValue={
                          localStorage.getItem("app_primary_color") || "#5b2b82"
                        }
                        onChange={(e) => {
                          const color = e.target.value;
                          document.documentElement.style.setProperty(
                            "--clr-header",
                            color
                          );
                          localStorage.setItem("app_primary_color", color);
                        }}
                      />
                    </div>

                    <div className="config-row">
                      <label htmlFor="logoutColor">Color del botón cerrar sesión y burbuja del chat usuario</label>
                      <input
                        id="logoutColor"
                        type="color"
                        defaultValue={
                          localStorage.getItem("logout_btn_color") || "#4B0F6B"
                        }
                        onChange={(e) => {
                          const color = e.target.value;
                          document.documentElement.style.setProperty(
                            "--clr-logout-btn",
                            color
                          );
                          localStorage.setItem("logout_btn_color", color);
                        }}
                      />
                    </div>

                    <div className="config-row">
                      <label htmlFor="logoutTextColor">
                        Color del texto botón cerrar sesión y texto burbuja del chat usuario
                      </label>
                      <input
                        id="logoutTextColor"
                        type="color"
                        defaultValue={
                          localStorage.getItem("logout_text_color") || "#ffffff"
                        }
                        onChange={(e) => {
                          const color = e.target.value;
                          document.documentElement.style.setProperty(
                            "--clr-logout-text",
                            color
                          );
                          localStorage.setItem("logout_text_color", color);
                        }}
                      />
                    </div>
                  </div>

                  {/* Columna menú */}
                  <div className="config-column">
                    <h3>Menú</h3>

                    <div className="config-row">
                      <label htmlFor="sidebarBtnColor">Color botones menú y botón enviar</label>
                      <input
                        id="sidebarBtnColor"
                        type="color"
                        defaultValue={
                          localStorage.getItem("sidebar_btn_color") || "#F49A20"
                        }
                        onChange={(e) => {
                          const color = e.target.value;
                          document.documentElement.style.setProperty(
                            "--clr-sidebar-btn",
                            color
                          );
                          localStorage.setItem("sidebar_btn_color", color);
                        }}
                      />
                    </div>

                    <div className="config-row">
                      <label htmlFor="sidebarTextColor">
                        Color texto botones menú y texto botón enviar
                      </label>
                      <input
                        id="sidebarTextColor"
                        type="color"
                        defaultValue={
                          localStorage.getItem("sidebar_text_color") || "#ffffff"
                        }
                        onChange={(e) => {
                          const color = e.target.value;
                          document.documentElement.style.setProperty(
                            "--clr-sidebar-text",
                            color
                          );
                          localStorage.setItem("sidebar_text_color", color);
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

// Exporta el componente principal
export default App;
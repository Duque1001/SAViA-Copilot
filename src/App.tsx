// Hooks de React para estado, efectos y referencias persistentes
import { useEffect, useRef, useState } from "react";

// Hooks de MSAL para saber si hay sesión y acceder a la instancia/auth
import { useIsAuthenticated, useMsal } from "@azure/msal-react";

// Funciones de sesión: obtener tokens, datos del usuario y cerrar sesión
import {
  acquireAccessToken,
  acquireIdToken,
  acquireValidIdToken,
  getName,
  getUniqueName,
  logoutAndGoHome,
} from "./config/session";

// Componentes principales de la interfaz
import ChatWindow from "./components/ChatWindow";
import ChatInput from "./components/ChatInput";
import Header from "./components/Header";
import SideNav from "./components/SideNav";
import Login from "./pages/Login";

// Estilos y traducciones
import "./App.css";
import { useTranslation } from "react-i18next";

// Lee la URL del backend desde variables de entorno
const RAW_API_URL = import.meta.env.VITE_CHAT_API_URL;

// Valida que la URL exista
if (!RAW_API_URL) throw new Error("VITE_CHAT_API_URL no está definida");

// Quita la "/" final para evitar errores al construir requests
const API_URL = RAW_API_URL.replace(/\/$/, "");

// Estructura de cada mensaje del chat
interface Message {
  id: string;
  from: "user" | "bot";
  text: string;
  isThinking?: boolean;
}

// Vistas permitidas en la aplicación
type ViewKey = "chat" | "config";

function App() {
  // Traducciones del módulo chat
  const { t } = useTranslation(["chat"]);

  // Estado global de autenticación y datos de MSAL
  const isAuthenticated = useIsAuthenticated();
  const { instance, accounts } = useMsal();

  // Obtiene email y un id amigable del usuario
  const email = accounts.length > 0 ? accounts[0].username : "";
  const userId = email.includes("@") ? email.split("@")[0] : email || "Usuario";

  // Estados de la interfaz
  const [activeView, setActiveView] = useState<ViewKey>("chat");
  const [isSideOpen, setSideOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Referencia para generar ids únicos de mensajes
  const messageIdRef = useRef(0);

  useEffect(() => {
    if (isAuthenticated && accounts.length > 0) return;
  
    setMessages([]);
    setInput("");
    setLoading(false);
    messageIdRef.current = 0;
  }, [isAuthenticated, accounts.length]);

  // Genera ids incrementales para cada mensaje
  const createMessageId = () => {
    messageIdRef.current += 1;
    return `msg-${messageIdRef.current}`;
  };

  // Al iniciar con sesión activa, prepara tokens y datos de autenticación
  useEffect(() => {
    const primeAuthArtifacts = async () => {
      if (!isAuthenticated || accounts.length === 0) return;

      await acquireIdToken(instance, accounts[0]).catch(console.error);
      await acquireAccessToken(instance, accounts[0]).catch(console.error);
    };

    primeAuthArtifacts().catch(console.error);
  }, [isAuthenticated, accounts, instance]);

  // Cierra sesión y redirige al inicio
  // const handleLogout = async () => {
  //   await logoutAndGoHome(instance);
  // };
  // Cierra sesión, limpia el chat local y redirige al inicio
  const handleLogout = async () => {
    setMessages([]);
    setInput("");
    setLoading(false);
    messageIdRef.current = 0;
    await logoutAndGoHome(instance);
  };

  // Envía el mensaje al backend usando un token fresco
  const sendMessageToApi = async (text: string) => {
    try {
      // Activa estado de carga
      setLoading(true);

      // Recupera datos del usuario guardados en sesión
      const storedName = getName();
      const storedUnique = getUniqueName();

      // Toma la cuenta autenticada actual
      const account = accounts[0];

      // Si no hay cuenta, cierra sesión
      if (!account) {
        await logoutAndGoHome(instance);
        return t("connectError");
      }

      // Pide un token nuevo/silencioso en cada consulta. Evita reutilizar un token vencido.
      const freshIdToken = await acquireValidIdToken(instance, account);

      // Si no pudo obtener token válido, cierra sesión
      if (!freshIdToken) {
        await logoutAndGoHome(instance);
        return t("connectError");
      }

      // Cuerpo de la petición al backend
      const payload = {
        session_id: storedUnique || storedName || userId,
        request_id: "1",
        text,
      };

      // Llamado a la API del chat
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${freshIdToken}`,
        },
        body: JSON.stringify(payload),
      });

      // Si backend rechaza el token, cierra sesión
      if (response.status === 401 || response.status === 403) {
        await logoutAndGoHome(instance);
        return t("connectError");
      }

      // Si hubo otro error HTTP, lanza excepción
      if (!response.ok) {
        throw new Error(`Error HTTP ${response.status}`);
      }

      // Lee y retorna la respuesta del bot
      const data = await response.json();
      return data.response;
    } catch (error) {
      console.error("Error en fetch:", error);

      // Ante error inesperado, cierra sesión para evitar que el chat quede usando una sesión inválida.
      await logoutAndGoHome(instance);
      return t("connectError");
    } finally {
      // Siempre apaga el estado de carga
      setLoading(false);
    }
  };

  // Maneja el envío del mensaje desde la UI
  const handleSend = async () => {
    // Evita enviar vacío o mientras carga
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");

    // Crea ids para mensaje del usuario y mensaje temporal del bot
    const userMessageId = createMessageId();
    const thinkingMessageId = createMessageId();

    // Agrega el mensaje del usuario y un "pensando..."
    setMessages((prev) => [
      ...prev,
      { id: userMessageId, from: "user", text: userMessage },
      { id: thinkingMessageId, from: "bot", text: t("thinking"), isThinking: true },
    ]);

    // Consulta la API
    const botResponse = await sendMessageToApi(userMessage);

    // Reemplaza el mensaje temporal con la respuesta real
    setMessages((prev) => {
      const updated = [...prev];
      let targetIndex = -1;

      for (let i = updated.length - 1; i >= 0; i--) {
        if (updated[i].id === thinkingMessageId) {
          targetIndex = i;
          break;
        }
      }

      if (targetIndex !== -1) {
        updated[targetIndex] = {
          ...updated[targetIndex],
          text: botResponse || t("connectError"),
          isThinking: false,
        };
      }

      return updated;
    });
  };

  // Si no hay autenticación, muestra la pantalla de login
  if (!isAuthenticated) return <Login />;

  // Nombre a mostrar en la cabecera
  const displayName = getName() || getUniqueName() || userId;

  return (
    <div className="app">
      {/* Encabezado principal con datos del usuario y logout */}
      <Header
        username={userId}
        displayName={displayName}
        onLogout={handleLogout}
        onToggleMenu={() => setSideOpen((v) => !v)}
      />

      <div className="app-shell">
        {/* Menú lateral de navegación */}
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
                {/* Ventana donde se renderizan los mensajes */}
                <ChatWindow messages={messages} />
              </div>

              {/* Input para escribir y enviar mensajes */}
              <ChatInput
                value={input}
                onChange={setInput}
                onSend={handleSend}
                disabled={loading}
              />
            </section>
          ) : (
            <section className="config-section">
              {/* Vista de configuración */}
              <div className="config-card">
                <h2>Configuración</h2>
                <p>Aquí puedes agregar opciones futuras de configuración.</p>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
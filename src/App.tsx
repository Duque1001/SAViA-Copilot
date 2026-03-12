// Hooks de React para manejar estado, referencias y efectos
import { useEffect, useRef, useState } from "react";

// Hooks de MSAL para manejar autenticación con Azure
import { useIsAuthenticated, useMsal } from "@azure/msal-react";

// Funciones de sesión para obtener datos del usuario y tokens
import {
  clearSession,
  acquireAccessToken,
  acquireIdToken,
  getName,
  getUniqueName,
  getIdToken,
} from "./config/session";

// Componentes principales de la aplicación
import ChatWindow from "./components/ChatWindow";
import ChatInput from "./components/ChatInput";
import Header from "./components/Header";
import SideNav from "./components/SideNav";
import Login from "./pages/Login";

// Estilos globales de la aplicación
import "./App.css";

// Hook para manejo de traducciones
import { useTranslation } from "react-i18next";

// Obtiene la URL de la API desde las variables de entorno
const RAW_API_URL = import.meta.env.VITE_CHAT_API_URL;

// Verifica que la URL esté definida
if (!RAW_API_URL) throw new Error("VITE_CHAT_API_URL no está definida");

// Elimina la "/" final si existe
const API_URL = RAW_API_URL.replace(/\/$/, "");

// Estructura de cada mensaje del chat
interface Message {
  id: string; // Identificador único del mensaje
  from: "user" | "bot"; // Indica quién envía el mensaje
  text: string; // Contenido del mensaje
  isThinking?: boolean; // Marca si el bot está generando respuesta
}

// Vistas disponibles en el menú lateral
type ViewKey = "chat" | "config";

// Componente principal de la aplicación
function App() {

  // Hook para traducciones
  const { t } = useTranslation(["chat"]);

  // Estado de autenticación del usuario
  const isAuthenticated = useIsAuthenticated();

  // Instancia de MSAL y cuentas autenticadas
  const { instance, accounts } = useMsal();

  // Obtiene el correo del usuario autenticado
  const email = accounts.length > 0 ? accounts[0].username : "";

  // Extrae el identificador del usuario desde el correo
  const userId = email.includes("@") ? email.split("@")[0] : email || "Usuario";

  // Vista activa del menú lateral
  const [activeView, setActiveView] = useState<ViewKey>("chat");

  // Estado que controla si el menú lateral está abierto
  const [isSideOpen, setSideOpen] = useState<boolean>(false);

  // Lista de mensajes del chat
  const [messages, setMessages] = useState<Message[]>([]);

  // Texto del input del usuario
  const [input, setInput] = useState("");

  // Estado de carga mientras se consulta la API
  const [loading, setLoading] = useState(false);

  // Referencia para generar IDs únicos de mensajes
  const messageIdRef = useRef(0);

  // Genera un nuevo ID de mensaje
  const createMessageId = () => {
    messageIdRef.current += 1;
    return `msg-${messageIdRef.current}`;
  };

  // Inicializa los tokens de autenticación al iniciar sesión
  useEffect(() => {
    const primeAuthArtifacts = async () => {

      // Sale si el usuario no está autenticado
      if (!isAuthenticated || accounts.length === 0) return;

      // Obtiene el idToken
      await acquireIdToken(instance, accounts[0]).catch(console.error);

      // Obtiene el accessToken
      await acquireAccessToken(instance, accounts[0]).catch(console.error);
    };

    primeAuthArtifacts().catch(console.error);

  }, [isAuthenticated, accounts, instance]);

  // Cierra sesión del usuario
  const handleLogout = () => {
    clearSession();
    instance.logoutPopup().catch(console.error);
  };

  // Envía un mensaje a la API del chatbot
  const sendMessageToApi = async (text: string) => {
    try {

      // Activa estado de carga
      setLoading(true);

      // Obtiene datos de sesión almacenados
      const storedName = getName();
      const storedUnique = getUniqueName();
      const idToken = getIdToken();

      // Construye el payload enviado al backend
      const payload = {
        session_id: storedUnique || storedName || userId,
        request_id: "1",
        text,
      };

      // Llamada POST a la API del chatbot
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload),
      });

      // Lanza error si la respuesta no es correcta
      if (!response.ok) throw new Error("Error HTTP");

      // Convierte la respuesta a JSON
      const data = await response.json();

      // Retorna la respuesta del bot
      return data.response;

    } catch (error) {

      console.error("Error en fetch:", error);

      // Devuelve mensaje de error traducido
      return t("connectError");

    } finally {

      // Desactiva estado de carga
      setLoading(false);
    }
  };

  // Maneja el envío de mensajes del usuario
  const handleSend = async () => {

    // Evita enviar si está vacío o cargando
    if (!input.trim() || loading) return;

    // Guarda el mensaje del usuario
    const userMessage = input.trim();

    // Limpia el input
    setInput("");

    // Genera IDs para los mensajes
    const userMessageId = createMessageId();
    const thinkingMessageId = createMessageId();

    // Agrega el mensaje del usuario y el mensaje temporal del bot
    setMessages((prev) => [
      ...prev,
      { id: userMessageId, from: "user", text: userMessage },
      { id: thinkingMessageId, from: "bot", text: t("thinking"), isThinking: true },
    ]);

    // Solicita respuesta al backend
    const botResponse = await sendMessageToApi(userMessage);

    // Reemplaza el mensaje temporal por la respuesta real
    setMessages((prev) => {
      const updated = [...prev];

      // Busca el índice del mensaje temporal
      let targetIndex = -1;

      for (let i = updated.length - 1; i >= 0; i--) {
        if (updated[i].id === thinkingMessageId) {
          targetIndex = i;
          break;
        }
      }

      // Si se encuentra, actualiza el mensaje
      if (targetIndex !== -1) {
        updated[targetIndex] = {
          ...updated[targetIndex],
          text: botResponse,
          isThinking: false,
        };
      }

      return updated;
    });
  };

  // Si el usuario no está autenticado, muestra la pantalla de login
  if (!isAuthenticated) return <Login />;

  // Nombre que se mostrará en la interfaz
  const displayName = getName() || getUniqueName() || userId;

  return (
    <div className="app">

      {/* Encabezado principal */}
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
        />

        <main className="content">

          {/* Vista principal del chat */}
          {activeView === "chat" ? (
            <section className="chat-section">

              {/* Ventana de conversación */}
              <div className="chat-card">
                <ChatWindow messages={messages} />
              </div>

              {/* Campo de entrada de mensajes */}
              <div className="chat-input-row">
                <ChatInput
                  value={input}
                  onChange={setInput}
                  onSend={handleSend}
                  disabled={loading}
                />
              </div>

            </section>
          ) : (

            // Vista de configuración (placeholder)
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

// Exporta el componente principal
export default App;
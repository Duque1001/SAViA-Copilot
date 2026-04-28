/* eslint-disable @typescript-eslint/no-explicit-any */

// Imports principales de React
import { useEffect, useMemo, useState } from "react";

// Autenticación con Microsoft MSAL
import { useIsAuthenticated, useMsal } from "@azure/msal-react";

// WebChat y conexión Direct Line
import ReactWebChat, { createDirectLine } from "botframework-webchat";

// Estilos globales
import "./App.css";

// Componentes de la app
import Header from "./components/Header";
import SideNav from "./components/SideNav";
import Login from "./pages/Login";
import Landing from "./pages/Landing";

// Utilidades de sesión
import {
  getName,
  getUniqueName,
  logoutAndGoHome,
} from "./config/session";

// Vistas disponibles
type ViewKey = "chat" | "config";

function App() {
  // Estado de autenticación
  const isAuthenticated = useIsAuthenticated();
  const { instance, accounts } = useMsal();

  // Datos básicos del usuario
  const email = accounts.length > 0 ? accounts[0].username : "";
  const userId = email.includes("@") ? email.split("@")[0] : email || "Usuario";

  // Estado de navegación
  const [activeView, setActiveView] = useState<ViewKey>("chat");
  const [isSideOpen, setSideOpen] = useState(false);

  // Controla si ya se vio la pantalla inicial
  const [landingSeen, setLandingSeen] = useState(
    () => localStorage.getItem("landingSeen") === "true"
  );

  // Estado del chat
  const [directLine, setDirectLine] = useState<any>(null);
  const [chatError, setChatError] = useState<string | null>(null);

  // Estilos del WebChat
  const styleOptions = useMemo(
    () => ({
      accent: "#004a99",
      botAvatarBackgroundColor: "#004a99",
      botAvatarInitials: "SA",
      userAvatarInitials: "YO",
      backgroundColor: "#f8f9fa",
    }),
    []
  );

  // Carga color guardado del header
  useEffect(() => {
    const savedColor = localStorage.getItem("app_primary_color");

    if (savedColor) {
      document.documentElement.style.setProperty("--clr-header", savedColor);
    }
  }, []);

  // Carga color guardado del botón logout
  useEffect(() => {
    const savedLogoutColor = localStorage.getItem("logout_btn_color");

    if (savedLogoutColor) {
      document.documentElement.style.setProperty("--clr-logout-btn", savedLogoutColor);
    }
  }, []);

  // Carga color guardado del texto logout
  useEffect(() => {
    const savedTextColor = localStorage.getItem("logout_text_color");

    if (savedTextColor) {
      document.documentElement.style.setProperty("--clr-logout-text", savedTextColor);
    }
  }, []);

  // Carga colores guardados del menú lateral
  useEffect(() => {
    const btnColor = localStorage.getItem("sidebar_btn_color");
    const textColor = localStorage.getItem("sidebar_text_color");

    if (btnColor) {
      document.documentElement.style.setProperty("--clr-sidebar-btn", btnColor);
    }

    if (textColor) {
      document.documentElement.style.setProperty("--clr-sidebar-text", textColor);
    }
  }, []);

  // Inicializa conexión con Direct Line
  useEffect(() => {
    // Claves usadas en localStorage
    const CHAT_TOKEN_KEY = "savio_token";
    const CHAT_CONVERSATION_KEY = "savio_conversation_id";
    const CHAT_WATERMARK_KEY = "savio_watermark";

    // Limpia solo datos del chat
    const clearChatStorage = () => {
      console.warn("Limpiando solo datos del chat en localStorage...");
      localStorage.removeItem(CHAT_TOKEN_KEY);
      localStorage.removeItem(CHAT_CONVERSATION_KEY);
      localStorage.removeItem(CHAT_WATERMARK_KEY);
    };

    // Genera un nuevo token Direct Line
    const generateToken = async (secret: string) => {
      console.log("Generando nuevo token Direct Line...");

      const response = await fetch(
        "https://directline.botframework.com/v3/directline/tokens/generate",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secret}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Generate token status:", response.status);
      console.log("Generate token ok:", response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Direct Line generate error body:", errorText);

        throw new Error(
          `Error generando token Direct Line. HTTP ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();
      console.log("Generate token response:", data);

      if (!data?.token || !data?.conversationId) {
        throw new Error("Direct Line no devolvió token o conversationId.");
      }

      return data;
    };

    // Refresca un token existente
    const refreshToken = async (token: string) => {
      console.log("Intentando refrescar token Direct Line existente...");

      const response = await fetch(
        "https://directline.botframework.com/v3/directline/tokens/refresh",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Refresh token status:", response.status);
      console.log("Refresh token ok:", response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.warn("No se pudo refrescar token:", errorText);
        throw new Error("Token anterior vencido o inválido.");
      }

      const data = await response.json();
      console.log("Refresh token response:", data);

      if (!data?.token) {
        throw new Error("Direct Line no devolvió token refrescado.");
      }

      return data;
    };

    // Conecta el chat usando token guardado o nuevo
    const connectChat = async () => {
      try {
        setChatError(null);

        // Lee secret desde variables de entorno
        const secret = import.meta.env.VITE_DIRECT_LINE_SECRET;

        console.log("Direct Line secret existe:", !!secret);

        if (!secret) {
          throw new Error("No se encontró VITE_DIRECT_LINE_SECRET en el archivo .env");
        }

        // Intenta recuperar sesión previa
        let token = localStorage.getItem(CHAT_TOKEN_KEY);
        let conversationId = localStorage.getItem(CHAT_CONVERSATION_KEY);
        let watermark = localStorage.getItem(CHAT_WATERMARK_KEY);

        console.log("Token guardado existe:", !!token);
        console.log("ConversationId guardado:", conversationId);

        // Si existe sesión previa, intenta refrescarla
        if (token && conversationId) {
          try {
            const refreshed = await refreshToken(token);
            token = refreshed.token;

            localStorage.setItem(CHAT_TOKEN_KEY, token as string);

            console.log("Token refrescado correctamente.");
          } catch (err) {
            console.warn("No se pudo usar la conversación anterior. Se creará una nueva.", err);

            clearChatStorage();

            const generated = await generateToken(secret);
            token = generated.token;
            conversationId = generated.conversationId;

            localStorage.setItem(CHAT_TOKEN_KEY, token as string);
            localStorage.setItem(CHAT_CONVERSATION_KEY, conversationId as string);

            console.log("Nueva conversación creada:", conversationId);
          }
        } else {
          // Si no existe sesión previa, crea una nueva
          const generated = await generateToken(secret);
          token = generated.token;
          conversationId = generated.conversationId;

          localStorage.setItem(CHAT_TOKEN_KEY, token as string);
          localStorage.setItem(CHAT_CONVERSATION_KEY, conversationId as string);

          console.log("Primera conversación creada:", conversationId);
        }

        // Crea conexión Direct Line
        const dl = createDirectLine({
          token: token as string,
          conversationId: conversationId as string,
          watermark: watermark || undefined,
          webSocket: false,
        });

        // Monitorea estado de conexión
        dl.connectionStatus$.subscribe((status) => {
          console.log("Direct Line connection status:", status);

          if (status === 2) {
            console.log("Direct Line conectado correctamente.");
          }

          if (status === 4) {
            console.error("Direct Line falló al conectar. Se limpiará la conversación guardada.");
            clearChatStorage();
          }
        });

        // Log de actividades del chat
        dl.activity$.subscribe({
          next: (activity) => {
            console.log("Actividad Direct Line:", activity);

            if (activity?.id) {
              const activityWatermark = activity.id.split("|").pop();
        
              if (activityWatermark) {
                localStorage.setItem(CHAT_WATERMARK_KEY, activityWatermark);
              }
            }
          },
          error: (err) => {
            console.error("Error en activity$:", err);
          },
        });

        // Guarda conexión en estado
        setDirectLine(dl);
      } catch (error: any) {
        console.error("Error conectando con el agente:", error);

        clearChatStorage();
        setChatError(error?.message || "No fue posible conectar con el agente.");
      }
    };

    // Solo conecta si el usuario está autenticado
    if (isAuthenticated && landingSeen && !directLine) {
      connectChat();
    }
  }, [isAuthenticated, landingSeen, directLine]);

  // Cierra sesión
  const handleLogout = async () => {
    localStorage.removeItem("landingSeen");
    await logoutAndGoHome(instance);
  };

  // Entrada desde landing
  const enterAppFromLanding = () => {
    localStorage.setItem("landingSeen", "true");
    setLandingSeen(true);
    setActiveView("chat");
  };

  // Vuelve al landing
  const goToLanding = () => {
    localStorage.removeItem("landingSeen");
    setSideOpen(false);
    setLandingSeen(false);
    setActiveView("chat");
    setDirectLine(null);
    setChatError(null);
  };

  // Si no está autenticado, muestra login
  if (!isAuthenticated) {
    return <Login />;
  }

  // Nombre visible del usuario
  const displayName = getName() || getUniqueName() || userId;

  // Si no ha visto landing, lo muestra
  if (!landingSeen) {
    return <Landing onEnterApp={enterAppFromLanding} />;
  }

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
          onSelect={(key: ViewKey) => {
            setActiveView(key);
            setSideOpen(false);
          }}
          onClose={() => setSideOpen(false)}
          onGoHome={goToLanding}
        />

        <main className="content">
          {/* Vista del chat */}
          <section
            className="chat-section"
            style={{ display: activeView === "chat" ? "grid" : "none" }}
          >
            <div className="chat-card">
              {chatError ? (
                // Error de conexión
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100%",
                    padding: "24px",
                    textAlign: "center",
                  }}
                >
                  <div>
                    <h3 style={{ marginBottom: "8px" }}>No se pudo conectar el chat</h3>
                    <p style={{ margin: 0 }}>{chatError}</p>
                  </div>
                </div>
              ) : !directLine ? (
                // Estado de carga
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100%",
                  }}
                >
                  <p>Cargando asistente SAV-iA...</p>
                </div>
              ) : (
                // WebChat conectado
                <div style={{ height: "100%", width: "100%" }}>
                  <ReactWebChat
                    directLine={directLine}
                    styleOptions={styleOptions}
                    locale="es-ES"
                    userID={email || "user_static_savios"}
                  />
                </div>
              )}
            </div>
          </section>

          {/* Vista de configuración */}
          <section
            className="config-section"
            style={{ display: activeView === "config" ? "block" : "none" }}
          >
            <div className="config-card">
              <h2>Configuración</h2>

              {/* Carga de logo */}
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
                {/* Configuración de header */}
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
                        document.documentElement.style.setProperty("--clr-header", color);
                        localStorage.setItem("app_primary_color", color);
                      }}
                    />
                  </div>

                  <div className="config-row">
                    <label htmlFor="logoutColor">
                      Color del botón cerrar sesión y burbuja del chat usuario
                    </label>
                    <input
                      id="logoutColor"
                      type="color"
                      defaultValue={
                        localStorage.getItem("logout_btn_color") || "#4B0F6B"
                      }
                      onChange={(e) => {
                        const color = e.target.value;
                        document.documentElement.style.setProperty("--clr-logout-btn", color);
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
                        document.documentElement.style.setProperty("--clr-logout-text", color);
                        localStorage.setItem("logout_text_color", color);
                      }}
                    />
                  </div>
                </div>

                {/* Configuración de menú */}
                <div className="config-column">
                  <h3>Menú</h3>

                  <div className="config-row">
                    <label htmlFor="sidebarBtnColor">
                      Color botones menú y botón enviar
                    </label>
                    <input
                      id="sidebarBtnColor"
                      type="color"
                      defaultValue={
                        localStorage.getItem("sidebar_btn_color") || "#F49A20"
                      }
                      onChange={(e) => {
                        const color = e.target.value;
                        document.documentElement.style.setProperty("--clr-sidebar-btn", color);
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
                        document.documentElement.style.setProperty("--clr-sidebar-text", color);
                        localStorage.setItem("sidebar_text_color", color);
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;
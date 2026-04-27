/* eslint-disable @typescript-eslint/no-explicit-any */
// Hooks de React para efectos, memoización y estado
import { useEffect, useMemo, useState } from "react";

// Hooks de MSAL para autenticación y acceso a la instancia
import { useIsAuthenticated, useMsal } from "@azure/msal-react";

// WebChat de Bot Framework y función para crear Direct Line
import ReactWebChat, { createDirectLine } from "botframework-webchat";

// Estilos globales de la aplicación
import "./App.css";

// Componentes principales
import Header from "./components/Header";
import SideNav from "./components/SideNav";
import Login from "./pages/Login";
import Landing from "./pages/Landing";

// Funciones de sesión
import {
  getName,
  getUniqueName,
  logoutAndGoHome,
} from "./config/session";

// Tipos de vistas disponibles en la app
type ViewKey = "chat" | "config";

function App() {
  const isAuthenticated = useIsAuthenticated();
  const { instance, accounts } = useMsal();

  const email = accounts.length > 0 ? accounts[0].username : "";
  const userId = email.includes("@") ? email.split("@")[0] : email || "Usuario";

  const [activeView, setActiveView] = useState<ViewKey>("chat");
  const [isSideOpen, setSideOpen] = useState(false);
  const [landingSeen, setLandingSeen] = useState(
    () => localStorage.getItem("landingSeen") === "true"
  );

  const [directLine, setDirectLine] = useState<any>(null);
  const [chatError, setChatError] = useState<string | null>(null);

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

  // Carga color principal del header
  useEffect(() => {
    const savedColor = localStorage.getItem("app_primary_color");
    if (savedColor) {
      document.documentElement.style.setProperty("--clr-header", savedColor);
    }
  }, []);

  // Carga color de fondo del botón logout
  useEffect(() => {
    const savedLogoutColor = localStorage.getItem("logout_btn_color");
    if (savedLogoutColor) {
      document.documentElement.style.setProperty("--clr-logout-btn", savedLogoutColor);
    }
  }, []);

  // Carga color de texto del botón logout
  useEffect(() => {
    const savedTextColor = localStorage.getItem("logout_text_color");
    if (savedTextColor) {
      document.documentElement.style.setProperty("--clr-logout-text", savedTextColor);
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

  // Conexión Direct Line
  useEffect(() => {
    const fetchToken = async () => {
      try {
        setChatError(null);

        const secret = import.meta.env.VITE_DIRECT_LINE_SECRET;
        console.log("Direct Line secret existe:", !!secret);
        console.log("Direct Line secret valor:", secret);

        if (!secret) {
          throw new Error("No se encontró VITE_DIRECT_LINE_SECRET en el archivo .env");
        }

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

        console.log("Response status:", response.status);
        console.log("Response ok:", response.ok);

        if (!response.ok) {
          const errorText = await response.text();
          console.log("Direct Line error body:", errorText);

          throw new Error(
            `Error generando token Direct Line. HTTP ${response.status} - ${errorText}`
          );
        }

        const data = await response.json();
        console.log("Direct Line token response:", data);

        if (!data?.token) {
          throw new Error("La respuesta de Direct Line no devolvió token.");
        }

        const dl = createDirectLine({ token: data.token });

        dl.connectionStatus$.subscribe((status) => {
          console.log("Direct Line connection status:", status);
        });

        dl.activity$.subscribe({
          next: (activity) => {
            console.log("Actividad Direct Line:", activity);
          },
          error: (err) => {
            console.error("Error en activity$:", err);
          },
        });

        setDirectLine(dl);
      } catch (error: any) {
        console.error("Error conectando con el agente:", error);
        setChatError(error?.message || "No fue posible conectar con el agente.");
      }
    };

    if (isAuthenticated && landingSeen && !directLine) {
      fetchToken();
    }
  }, [isAuthenticated, landingSeen, directLine]);

  const handleLogout = async () => {
    localStorage.removeItem("landingSeen");
    await logoutAndGoHome(instance);
  };

  const enterAppFromLanding = () => {
    localStorage.setItem("landingSeen", "true");
    setLandingSeen(true);
    setActiveView("chat");
  };

  const goToLanding = () => {
    localStorage.removeItem("landingSeen");
    setSideOpen(false);
    setLandingSeen(false);
    setActiveView("chat");
    setDirectLine(null);
    setChatError(null);
  };

  if (!isAuthenticated) {
    return <Login />;
  }

  const displayName = getName() || getUniqueName() || userId;

  if (!landingSeen) {
    return <Landing onEnterApp={enterAppFromLanding} />;
  }

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
          onSelect={(key: ViewKey) => {
            setActiveView(key);
            setSideOpen(false);
          }}
          onClose={() => setSideOpen(false)}
          onGoHome={goToLanding}
        />

        <main className="content">
          <section
            className="chat-section"
            style={{ display: activeView === "chat" ? "grid" : "none" }}
          >
            <div className="chat-card">
              {chatError ? (
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
                <div style={{ height: "100%", width: "100%" }}>
                  <ReactWebChat
                    directLine={directLine}
                    styleOptions={styleOptions}
                    locale="es-ES"
                  />
                </div>
              )}
            </div>
          </section>

          <section
            className="config-section"
            style={{ display: activeView === "config" ? "block" : "none" }}
          >
            <div className="config-card">
              <h2>Configuración</h2>

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
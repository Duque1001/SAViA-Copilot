// Importa los estilos del menú lateral
import "../styles/SideNav.css";

import saviaLogo from "../assets/images/savia-logo.png";

// Hook para manejar traducciones
import { useTranslation } from "react-i18next";

// Componente que contiene los enlaces/redes sociales
import SocialLinks from "./SocialLinks";

// Tipos de vistas disponibles en el menú
type ViewKey = "chat" | "config";

// Props que recibe el SideNav
interface SideNavProps {
  activeKey: ViewKey; // Vista actualmente activa
  isOpen: boolean; // Indica si el menú está abierto
  onSelect: (key: ViewKey) => void; // Función para cambiar de vista
  onClose: () => void; // Función para cerrar el menú
}

// Componente del menú lateral
export default function SideNav({ activeKey, isOpen, onSelect, onClose }: SideNavProps) {

  // Hook para obtener textos traducidos
  const { t } = useTranslation(["chat"]);

  return (
    <>
      {/* Fondo oscuro que aparece cuando el menú está abierto */}
      <div
        className={`overlay ${isOpen ? "overlay--show" : ""}`}
        onClick={onClose} // Cierra el menú al hacer click
        aria-hidden={!isOpen}
      />

      {/* Contenedor principal del menú lateral */}
      <aside className={`sidenav ${isOpen ? "sidenav--open" : ""}`}>

        {/* Navegación del menú */}
        <nav className="sidenav__nav">

          {/* Botón para ir a la vista de chat */}
          <button
            className={`nav-btn ${activeKey === "chat" ? "nav-btn--active" : ""}`}
            onClick={() => onSelect("chat")}
          >
            {t("sidenavChat")}
          </button>

          {/* Botón para ir a la vista de configuración */}
          <button
            className={`nav-btn ${activeKey === "config" ? "nav-btn--active" : ""}`}
            onClick={() => onSelect("config")}
          >
            {t("sidenavConfig")}
          </button>

        </nav>

        {/* Sección inferior con enlaces o redes sociales */}
        <div className="sidenav__footer">
          <div className="sidenav__brand">
            <img src={saviaLogo} alt="SAV-IA" className="sidenav__brand-logo" />
          </div>
          
          <SocialLinks />
        </div>

      </aside>
    </>
  );
}
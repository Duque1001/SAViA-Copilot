// Importa los estilos del header
import "../styles/Header.css";

// Importa el logo de la aplicación
//import saviaLogo from "../assets/images/savia-logo_.png";

import logoSavios from "../assets/images/logo-savios.png";

// Funciones para obtener datos del usuario guardados en sesión
import { getName, getUniqueName } from "../config/session";

// Hook para manejar traducciones
import { useTranslation } from "react-i18next";


// Props que recibe el componente Header
interface HeaderProps {
  username: string; // Usuario autenticado
  displayName?: string; // Nombre para mostrar (opcional)
  onLogout: () => void; // Función para cerrar sesión
  onToggleMenu?: () => void; // Función para abrir/cerrar menú lateral
}

// Componente del encabezado de la aplicación
export default function Header({ username, displayName, onLogout, onToggleMenu }: HeaderProps) {

  // Hook de traducciones usando los namespaces "common" y "chat"
  const { t } = useTranslation(["common", "chat"]);

  // Obtiene nombre guardado en sesión
  const storedName = getName();

  // Obtiene nombre único
  const storedUnique = getUniqueName();

  // Determina el nombre que se mostrará en el header
  const nameToShow = displayName || storedName || storedUnique || username;

  return (
    // Contenedor principal del header
    <header className="header">

      {/* Sección izquierda: menú y logo */}
      <div className="header__left">

        {/* Botón para abrir/cerrar menú lateral */}
        <button
          className="menu-toggle"
          aria-label={t("openMenu", { ns: "common" })}
          onClick={onToggleMenu}
        >
          ☰
        </button>

        {/* Logo de la aplicación */}
        {/* <img src={saviaLogo} alt="SAV-IA" className="logo" /> */}
        <img src={logoSavios} alt="SAVIOS" className="logo" />

      </div>

      {/* Sección derecha: saludo y logout */}
      <div className="header__right">

        {/* Mensaje de bienvenida con el nombre del usuario */}
        <span className="welcome">
          {t("hello", { ns: "common" })}: <strong>{nameToShow}</strong>
        </span>

        {/* Botón para cerrar sesión */}
        <button className="btn btn--logout" onClick={onLogout}>
          {t("logout", { ns: "chat" })}
        </button>

      </div>

    </header>
  );
}
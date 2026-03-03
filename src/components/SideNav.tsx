import "../styles/SideNav.css";
import { useTranslation } from "react-i18next";

type ViewKey = "chat" | "config";

interface SideNavProps {
  activeKey: ViewKey;
  isOpen: boolean;
  onSelect: (key: ViewKey) => void;
  onClose: () => void;
}

export default function SideNav({ activeKey, isOpen, onSelect, onClose }: SideNavProps) {
  const { t } = useTranslation(["chat"]);

  return (
    <>
      <div
        className={`overlay ${isOpen ? "overlay--show" : ""}`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      <aside className={`sidenav ${isOpen ? "sidenav--open" : ""}`}>
        <nav className="sidenav__nav">
          <button
            className={`nav-btn ${activeKey === "chat" ? "nav-btn--active" : ""}`}
            onClick={() => onSelect("chat")}
          >
            {t("sidenavChat")}
          </button>

          <button
            className={`nav-btn ${activeKey === "config" ? "nav-btn--active" : ""}`}
            onClick={() => onSelect("config")}
          >
            {t("sidenavConfig")}
          </button>
        </nav>
      </aside>
    </>
  );
}

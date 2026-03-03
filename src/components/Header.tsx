import "../styles/Header.css";
import saviaLogo from "../assets/images/savia-logo_.png";
import { getName, getUniqueName } from "../config/session";
import { useTranslation } from "react-i18next";

interface HeaderProps {
  username: string;
  displayName?: string;
  onLogout: () => void;
  onToggleMenu?: () => void;
}

export default function Header({ username, displayName, onLogout, onToggleMenu }: HeaderProps) {
  const { t } = useTranslation(["common", "chat"]);

  const storedName = getName();
  const storedUnique = getUniqueName();
  const nameToShow = displayName || storedName || storedUnique || username;

  return (
    <header className="header">
      <div className="header__left">
        <button className="menu-toggle" aria-label={t("openMenu", { ns: "common" })} onClick={onToggleMenu}>
          ☰
        </button>
        <img src={saviaLogo} alt="SAV-IA" className="logo" />
      </div>

      <div className="header__right">
        <span className="welcome">
          {t("hello", { ns: "common" })}: <strong>{nameToShow}</strong>
        </span>
        <button className="btn btn--logout" onClick={onLogout}>
          {t("logout", { ns: "chat" })}
        </button>
      </div>
    </header>
  );
}

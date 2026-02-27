import "../styles/Header.css";
import saviaLogo from "../assets/images/savia-logo.png";
import { getName, getUniqueName } from "../config/session";

interface HeaderProps {
    username: string;
    displayName?: string;
    onLogout: () => void;
}

export default function Header({ username, displayName, onLogout }: HeaderProps) {
    const storedName = getName();
    const storedUnique = getUniqueName();

    const nameToShow = displayName || storedName || storedUnique || username;

    return (
        <header className="header">
            <img src={saviaLogo} alt="Savia Logo" className="logo" />

            <div className="session-info">
                <span className="session-name">
                    Hola: <strong>{nameToShow}</strong>
                    {storedUnique && (
                        <span style={{ fontSize: "12px", opacity: 0.7 }}> ({storedUnique})</span>
                    )}
                </span>
                <button onClick={onLogout}>Cerrar sesión</button>
            </div>
        </header>
    );
}
// Importa los estilos de la pantalla Landing
import "../styles/Landing.css";

// Importa la imagen de fondo para pantallas de escritorio
import bgDesktop from "../assets/images/savia-landing_1.png";

// Importa la imagen de fondo para pantallas pequeñas / móviles
import bgMobile from "../assets/images/savia-landing_2.png";

// Importa el logo principal de SAVIA
import logoSavia from "../assets/images/savia-logo_.png";

// Importa la imagen que funciona como botón de entrada
import btnSavia from "../assets/images/btn_savia.png";

// Selecciona la imagen de fondo según el ancho de la pantalla
const bg = window.innerWidth <= 320 ? bgMobile : bgDesktop;

// Props que recibe el componente Landing
interface LandingProps {
    onEnterApp: () => void; // Función para entrar a la aplicación
}

// Componente Landing
const Landing = ({ onEnterApp }: LandingProps) => {
    return (
        // Contenedor principal de la pantalla de bienvenida
        <div
            className="landing-root"
            style={{ backgroundImage: `url(${bg})` }} // Asigna fondo dinámico
            role="region"
            aria-label="Landing SAV-IA"
        >
            {/* Encabezado con logo y subtítulo */}
            <header className="landing-header">
                <img src={logoSavia} alt="SAVIA" className="logoSavia" />
                <p className="landing-subtitle">
                    CONOCIMIENTO VIVO IMPULSADO POR INTELIGENCIA ARTIFICIAL
                </p>
            </header>

            {/* Cuerpo principal con título, descripción y botón */}
            <div className="landing-body">
                <p className="landing-title">
                    BASE DE CONOCIMIENTO ORGANIZACIONAL
                </p>

                <p className="landing-description">
                    Accede al conocimiento institucional de tu
                    organización en un solo lugar.
                    Consulta procesos, documentos y lineamientos mediante
                    conversación.
                </p>

                {/* Pie con botón para ingresar al chat */}
                <div className="landing-footer">
                    <img
                        src={btnSavia}
                        alt="Hablar con SAV-IA"
                        className="landing-btnHabla"
                        role="button"
                        tabIndex={0} // Permite enfoque con teclado
                        aria-label="Hablar con SAV-IA"
                        onClick={onEnterApp} // Entra a la app al hacer clic
                        onKeyDown={(e) => {
                            // Permite activar con Enter o barra espaciadora
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onEnterApp();
                            }
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

// Exporta el componente para usarlo en otras partes
export default Landing;
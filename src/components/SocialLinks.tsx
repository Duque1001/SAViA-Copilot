// Importa los íconos de redes sociales
import instagramIcon from "../assets/images/logo-instagram.png";
import linkedinIcon from "../assets/images/logo-linkedin.png";
import webIcon from "../assets/images/logo-web.png";

// Importa los estilos del componente
import "../styles/SocialLinks.css";

// Componente que muestra enlaces a redes sociales
export default function SocialLinks() {
  return (
    // Contenedor de los íconos de redes sociales
    <div className="social-links" aria-label="Redes sociales">
      {/* Enlace a Instagram */}
      <a
        href="https://www.instagram.com/savioslatam/"
        target="_blank" // Abre el enlace en una nueva pestaña
        rel="noreferrer" // Seguridad al abrir enlaces externos
        aria-label="Instagram Savios Latam"
        title="Instagram"
      >
        <img src={instagramIcon} alt="Instagram" /> {/* Ícono de Instagram */}
      </a>

      {/* Enlace a LinkedIn */}
      <a
        href="https://www.linkedin.com/company/savioslatam/"
        target="_blank"
        rel="noreferrer"
        aria-label="LinkedIn Savios Latam"
        title="LinkedIn"
      >
        <img src={linkedinIcon} alt="LinkedIn" /> {/* Ícono de LinkedIn */}
      </a>

      {/* Enlace al sitio web */}
      <a
        href="https://savios.com.co/"
        target="_blank"
        rel="noreferrer"
        aria-label="Sitio web Savios"
        title="Sitio web"
      >
        <img src={webIcon} alt="Web" /> {/* Ícono del sitio web */}
      </a>
    </div>
  );
}
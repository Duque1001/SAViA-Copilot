// Hooks de React para manejar estado, efectos y referencias
import { useEffect, useMemo, useRef, useState } from "react";

// Componente para renderizar Markdown
import ReactMarkdown from "react-markdown";

// Plugin para tablas, listas y más sintaxis Markdown
import remarkGfm from "remark-gfm";

// Plugin para respetar saltos de línea
import remarkBreaks from "remark-breaks";

// Props del componente TypingMessage
interface TypingMessageProps {
  text: string; // Texto que debe mostrarse
  speed?: number; // Velocidad de escritura
  onTypingProgress?: () => void; // Callback durante la escritura
  onComplete?: () => void; // Callback cuando termina la animación
}

// Componente que simula el efecto de escritura del bot
export default function TypingMessage({
  text,
  speed = 5,
  onTypingProgress,
  onComplete,
}: TypingMessageProps) {

  // Normaliza el texto reemplazando "\n" por saltos reales
  const normalizedText = useMemo(() => {
    return String(text || "").replace(/\\n/g, "\n");
  }, [text]);

  // Estado que guarda el texto que se ha mostrado hasta el momento
  const [displayedText, setDisplayedText] = useState("");

  // Referencia para controlar el timeout de la animación
  const timeoutRef = useRef<number | null>(null);

  // Efecto que ejecuta la animación de tipeo
  useEffect(() => {
    let index = 0; // Posición actual del texto

    const typeNext = () => {
      index += 1;

      // Obtiene el texto que se mostrará hasta el índice actual
      const nextText = normalizedText.slice(0, index);
      setDisplayedText(nextText);

      // Notifica progreso de escritura
      onTypingProgress?.();

      // Si aún faltan caracteres, continúa la animación
      if (index < normalizedText.length) {
        const currentChar = normalizedText[index - 1];

        // Ajusta velocidad según el tipo de carácter
        let delay = speed;
        if (currentChar === " ") delay = 3;
        if ([",", ".", ":", ";"].includes(currentChar)) delay = 10;
        if (currentChar === "\n") delay = 8;

        // Programa el siguiente carácter
        timeoutRef.current = window.setTimeout(typeNext, delay);
      } else {
        // Notifica cuando termina la animación
        onComplete?.();
      }
    };

    // Inicia la animación si hay texto
    if (normalizedText.length > 0) {
      timeoutRef.current = window.setTimeout(typeNext, speed);
    } else {
      onComplete?.();
    }

    // Limpia el timeout al desmontar el componente
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [normalizedText, speed]);

  // Verifica si el texto ya terminó de escribirse
  const isFinished = displayedText.length >= normalizedText.length;

  // Mientras escribe, muestra el texto parcial con cursor
  if (!isFinished) {
    return (
      <div className="message-content typing-content">
        <span style={{ whiteSpace: "pre-wrap" }}>{displayedText}</span>
        <span className="typing-cursor">▍</span>
      </div>
    );
  }

  // Cuando termina, renderiza el texto completo como Markdown
  return (
    <div className="message-content markdown-content">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
        {normalizedText}
      </ReactMarkdown>
    </div>
  );
}
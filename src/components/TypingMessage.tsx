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
  text: string;
  speed?: number;
  onTypingProgress?: () => void;
  onComplete?: () => void;
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

  useEffect(() => {
    let index = 0;

    const clearCurrentTimeout = () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const typeNext = () => {
      index += 1;

      const nextText = normalizedText.slice(0, index);
      setDisplayedText(nextText);

      onTypingProgress?.();

      if (index < normalizedText.length) {
        const currentChar = normalizedText[index - 1];

        let delay = speed;
        if (currentChar === " ") delay = 3;
        if ([",", ".", ":", ";"].includes(currentChar)) delay = 10;
        if (currentChar === "\n") delay = 8;

        timeoutRef.current = window.setTimeout(typeNext, delay);
      } else {
        onComplete?.();
      }
    };

    clearCurrentTimeout();

    if (normalizedText.length > 0) {
      timeoutRef.current = window.setTimeout(typeNext, speed);
    } else {
      onComplete?.();
    }

    return () => {
      clearCurrentTimeout();
    };
  }, [normalizedText, speed, onTypingProgress, onComplete]);

  const isFinished = displayedText.length >= normalizedText.length;

  if (!isFinished) {
    return (
      <div className="message-content typing-content">
        <span style={{ whiteSpace: "pre-wrap" }}>{displayedText}</span>
        <span className="typing-cursor">▍</span>
      </div>
    );
  }

  return (
    <div className="message-content markdown-content">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
        {normalizedText}
      </ReactMarkdown>
    </div>
  );
}
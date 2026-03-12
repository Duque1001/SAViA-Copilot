// Importa los estilos del chat
import "../styles/Chat.css";

// Hooks de React usados en el componente
import { useCallback, useEffect, useRef, useState } from "react";

// Componente para renderizar Markdown
import ReactMarkdown from "react-markdown";

// Plugin para tablas, listas y más sintaxis Markdown
import remarkGfm from "remark-gfm";

// Plugin para respetar saltos de línea
import remarkBreaks from "remark-breaks";

// Componente que muestra el efecto de escritura
import TypingMessage from "./TypingMessage";

// Estructura de cada mensaje
interface Message {
  id: string; // Identificador único del mensaje
  from: "user" | "bot"; // Indica quién envía el mensaje
  text: string; // Contenido del mensaje
  isThinking?: boolean; // Marca si el bot está "pensando"
}

// Props del componente
interface ChatWindowProps {
  messages: Message[]; // Lista de mensajes del chat
}

// Componente que renderiza la ventana del chat
export default function ChatWindow({ messages }: ChatWindowProps) {
  // Referencia al contenedor del chat
  const chatRef = useRef<HTMLDivElement | null>(null);

  // Guarda si el auto-scroll está activo
  const autoScrollEnabledRef = useRef(true);

  // Guarda los mensajes que ya terminaron de animarse
  const [completedTypingIds, setCompletedTypingIds] = useState<Set<string>>(new Set());

  // Lleva el scroll al final del chat
  const scrollToBottom = useCallback((force = false) => {
    requestAnimationFrame(() => {
      const el = chatRef.current;
      if (!el) return; // Sale si no existe el contenedor

      // Si no es forzado y el usuario subió manualmente, no baja
      if (!force && !autoScrollEnabledRef.current) return;

      // Mueve el scroll al final
      el.scrollTop = el.scrollHeight;
    });
  }, []);

  // Detecta si el usuario está cerca del final del chat
  const handleScroll = useCallback(() => {
    const el = chatRef.current;
    if (!el) return; // Sale si no existe el contenedor

    const threshold = 80; // Margen para considerar "cerca del final"
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;

    // Activa auto-scroll solo si está cerca del final
    autoScrollEnabledRef.current = distanceFromBottom <= threshold;
  }, []);

  // Hace scroll al final cuando cambian los mensajes
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Hace scroll forzado al montar el componente
  useEffect(() => {
    scrollToBottom(true);
  }, [scrollToBottom]);

  return (
    // Contenedor principal del chat con scroll
    <div className="chat-container" ref={chatRef} onScroll={handleScroll}>
      {messages.map((msg) => {
        // Define si este mensaje debe animarse
        const shouldAnimate =
          msg.from === "bot" &&
          !msg.isThinking &&
          !completedTypingIds.has(msg.id);

        return (
          <div
            key={msg.id} // Clave única para React
            className={`message ${msg.from} ${msg.isThinking ? "thinking" : ""}`}
          >
            {msg.from === "bot" ? (
              msg.isThinking ? (
                // Muestra mensaje temporal mientras el bot responde
                <div className="message-content typing-content">{msg.text}</div>
              ) : shouldAnimate ? (
                // Muestra animación de escritura para respuestas nuevas
                <TypingMessage
                  key={`typing-${msg.id}`} // Clave única del mensaje animado
                  text={msg.text} // Texto que se animará
                  speed={18} // Velocidad de escritura
                  onTypingProgress={scrollToBottom} // Hace scroll mientras escribe
                  onComplete={() => {
                    // Marca el mensaje como completado
                    setCompletedTypingIds((prev) => {
                      if (prev.has(msg.id)) return prev; // Evita duplicados

                      const next = new Set(prev); // Copia el set actual
                      next.add(msg.id); // Agrega el id completado
                      return next; // Retorna el nuevo set
                    });
                  }}
                />
              ) : (
                // Renderiza el mensaje del bot como Markdown normal
                <div className="message-content markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                    {String(msg.text || "").replace(/\\n/g, "\n")}
                  </ReactMarkdown>
                </div>
              )
            ) : (
              // Renderiza el mensaje del usuario
              <div className="message-content user-content">{msg.text}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
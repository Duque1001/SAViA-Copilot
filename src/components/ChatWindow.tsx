// // Importa los estilos del chat
// import "../styles/Chat.css";

// // Hooks de React usados en el componente
// import { useCallback, useEffect, useRef } from "react";

// // Componente para renderizar Markdown
// import ReactMarkdown from "react-markdown";

// // Plugin para tablas, listas y más sintaxis Markdown
// import remarkGfm from "remark-gfm";

// // Plugin para respetar saltos de línea
// import remarkBreaks from "remark-breaks";

// // Componente que muestra el efecto de escritura
// import TypingMessage from "./TypingMessage";

// // Estructura de cada mensaje
// interface Message {
//   id: string; // Identificador único del mensaje
//   from: "user" | "bot"; // Indica quién envía el mensaje
//   text: string; // Contenido del mensaje
//   isThinking?: boolean; // Marca si el bot está "pensando"
// }

// // Props del componente
// interface ChatWindowProps {
//   messages: Message[]; // Lista de mensajes del chat
// }

// // Componente que renderiza la ventana del chat
// export default function ChatWindow({ messages }: ChatWindowProps) {
//   // Referencia al contenedor del chat
//   const chatRef = useRef<HTMLDivElement | null>(null);

//   // Guarda si el auto-scroll está activo
//   const autoScrollEnabledRef = useRef(true);

//   // Todos los mensajes del bot excepto el último se consideran ya "completados"
//   // para evitar que se vuelvan a animar al remontar el componente.
//   const completedTypingIds = new Set(
//     messages
//       .filter((msg) => msg.from === "bot" && !msg.isThinking)
//       .slice(0, -1)
//       .map((msg) => msg.id)
//   );

//   // Lleva el scroll al final del chat
//   const scrollToBottom = useCallback((force = false) => {
//     requestAnimationFrame(() => {
//       const el = chatRef.current;
//       if (!el) return;

//       // Si no es forzado y el usuario subió manualmente, no baja
//       if (!force && !autoScrollEnabledRef.current) return;

//       // Mueve el scroll al final
//       el.scrollTop = el.scrollHeight;
//     });
//   }, []);

//   // Detecta si el usuario está cerca del final del chat
//   const handleScroll = useCallback(() => {
//     const el = chatRef.current;
//     if (!el) return;

//     const threshold = 80;
//     const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;

//     // Activa auto-scroll solo si está cerca del final
//     autoScrollEnabledRef.current = distanceFromBottom <= threshold;
//   }, []);

//   // Hace scroll al final cuando cambian los mensajes
//   useEffect(() => {
//     scrollToBottom();
//   }, [messages, scrollToBottom]);

//   // Hace scroll forzado al montar el componente
//   useEffect(() => {
//     scrollToBottom(true);
//   }, [scrollToBottom]);

//   return (
//     <div className="chat-container" ref={chatRef} onScroll={handleScroll}>
//       {messages.map((msg) => {
//         // Solo se anima el último mensaje terminado del bot
//         const shouldAnimate =
//           msg.from === "bot" &&
//           !msg.isThinking &&
//           !completedTypingIds.has(msg.id);

//         return (
//           <div
//             key={msg.id}
//             className={`message ${msg.from} ${msg.isThinking ? "thinking" : ""}`}
//           >
//             {msg.from === "bot" ? (
//               msg.isThinking ? (
//                 <div className="message-content typing-content">{msg.text}</div>
//               ) : shouldAnimate ? (
//                 <TypingMessage
//                   key={`typing-${msg.id}`}
//                   text={msg.text}
//                   speed={18}
//                   onTypingProgress={() => scrollToBottom()}
//                   onComplete={() => {
//                     scrollToBottom(true);
//                   }}
//                 />
//               ) : (
//                 <div className="message-content markdown-content">
//                   <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
//                     {String(msg.text || "").replace(/\\n/g, "\n")}
//                   </ReactMarkdown>
//                 </div>
//               )
//             ) : (
//               <div className="message-content user-content">{msg.text}</div>
//             )}
//           </div>
//         );
//       })}
//     </div>
//   );
// }

import "../styles/Chat.css";
import { useCallback, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import TypingMessage from "./TypingMessage";

interface Message {
  id: string;
  from: "user" | "bot";
  text: string;
  isThinking?: boolean;
  shouldAnimate?: boolean;
}

interface ChatWindowProps {
  messages: Message[];
  onBotTypingComplete: (messageId: string) => void;
}

export default function ChatWindow({
  messages,
  onBotTypingComplete,
}: ChatWindowProps) {
  const chatRef = useRef<HTMLDivElement | null>(null);
  const autoScrollEnabledRef = useRef(true);

  const scrollToBottom = useCallback((force = false) => {
    requestAnimationFrame(() => {
      const el = chatRef.current;
      if (!el) return;

      if (!force && !autoScrollEnabledRef.current) return;
      el.scrollTop = el.scrollHeight;
    });
  }, []);

  const handleScroll = useCallback(() => {
    const el = chatRef.current;
    if (!el) return;

    const threshold = 80;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    autoScrollEnabledRef.current = distanceFromBottom <= threshold;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    scrollToBottom(true);
  }, [scrollToBottom]);

  return (
    <div className="chat-container" ref={chatRef} onScroll={handleScroll}>
      {messages.map((msg) => {
        const shouldAnimate =
          msg.from === "bot" &&
          !msg.isThinking &&
          msg.shouldAnimate === true;

        return (
          <div
            key={msg.id}
            className={`message ${msg.from} ${msg.isThinking ? "thinking" : ""}`}
          >
            {msg.from === "bot" ? (
              msg.isThinking ? (
                <div className="message-content typing-content">{msg.text}</div>
              ) : shouldAnimate ? (
                <TypingMessage
                  key={`typing-${msg.id}`}
                  text={msg.text}
                  speed={18}
                  onTypingProgress={scrollToBottom}
                  onComplete={() => {
                    scrollToBottom(true);
                    onBotTypingComplete(msg.id);
                  }}
                />
              ) : (
                <div className="message-content markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                    {String(msg.text || "").replace(/\\n/g, "\n")}
                  </ReactMarkdown>
                </div>
              )
            ) : (
              <div className="message-content user-content">{msg.text}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
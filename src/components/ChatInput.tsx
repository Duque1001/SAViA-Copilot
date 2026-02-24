import "./ChatInput.css";

interface ChatInputProps {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
    disabled: boolean;
}

function ChatInput({ value, onChange, onSend, disabled }: ChatInputProps) {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !disabled) {
            e.preventDefault();
            onSend();
        }
    };

    return (
        <div className="chat-input">
            <input
                type="text"
                value={value}
                disabled={disabled}
                placeholder={disabled ? "El bot está respondiendo..." : "Escribe tu mensaje..."}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
            />
            <button onClick={onSend} disabled={disabled}>
                Enviar
            </button>
        </div>
    );
}

export default ChatInput;
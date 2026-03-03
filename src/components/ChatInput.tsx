import "../styles/Chat.css";
import { useTranslation } from "react-i18next";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
}

export default function ChatInput({ value, onChange, onSend, disabled = false }: ChatInputProps) {
  const { t } = useTranslation(["chat"]);

  return (
    <div className="input-container">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && !disabled && onSend()}
        disabled={disabled}
        placeholder={t("inputPlaceholder")}
      />
      <button onClick={onSend} disabled={disabled}>
        {t("send")}
      </button>
    </div>
  );
}
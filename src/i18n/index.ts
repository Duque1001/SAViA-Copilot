import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import common_es from "./locales/es/common.json";
import common_en from "./locales/en/common.json";
import login_es from "./locales/es/login.json";
import login_en from "./locales/en/login.json";
import chat_es from "./locales/es/chat.json";
import chat_en from "./locales/en/chat.json";

i18n
  .use(LanguageDetector) // detecta idioma desde localStorage o navegador
  .use(initReactI18next)
  .init({
    fallbackLng: "es", // idioma por defecto
    supportedLngs: ["es", "en"], // idiomas soportados
    ns: ["common", "login", "chat"], // namespaces
    defaultNS: "common",

    resources: {
      es: { common: common_es, login: login_es, chat: chat_es },
      en: { common: common_en, login: login_en, chat: chat_en },
    },

    detection: {
      order: ["localStorage", "navigator"], // prioridad
      caches: ["localStorage"], // guarda selección
      lookupLocalStorage: "lang", // clave usada
    },

    interpolation: {
      escapeValue: false, // React ya protege contra XSS
    },
  });

export default i18n;
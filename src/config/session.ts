// Tipos e importaciones de MSAL para manejar cuentas, tokens y errores de autenticación
import type { AccountInfo, IPublicClientApplication } from "@azure/msal-browser";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

// Claves usadas para guardar datos de sesión en localStorage
const ACCESS_TOKEN_KEY = "access_token";
const USERNAME_KEY = "username";
const ID_TOKEN_KEY = "id_token";
const NAME_KEY = "name";
const UNIQUE_NAME_KEY = "unique_name";

// Decodifica el payload de un JWT para leer sus claims
function decodeJwtPayload(token: string): any | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;

    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");

    const padded =
      base64.length % 4 === 2
        ? base64 + "=="
        : base64.length % 4 === 3
        ? base64 + "="
        : base64;

    const json = JSON.parse(
      decodeURIComponent(
        atob(padded)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      )
    );

    return json;
  } catch {
    return null;
  }
}

// Verifica si un token JWT ya expiró o está por expirar
function isJwtExpired(token: string, skewSec = 60): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;

  const now = Math.floor(Date.now() / 1000);
  return now + skewSec >= Number(payload.exp);
}

// Guarda access token y username en sesión local
export const saveSession = (accessToken: string, username: string) => {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken || "");
  localStorage.setItem(USERNAME_KEY, username);
};

// Limpia toda la información de sesión almacenada
export const clearSession = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
  localStorage.removeItem(ID_TOKEN_KEY);
  localStorage.removeItem(NAME_KEY);
  localStorage.removeItem(UNIQUE_NAME_KEY);
};

// Obtiene el access token guardado
export const getAccessToken = (): string | null =>
  localStorage.getItem(ACCESS_TOKEN_KEY);

// Obtiene el username guardado
export const getUsername = (): string | null =>
  localStorage.getItem(USERNAME_KEY);

// Obtiene el nombre guardado
export const getName = (): string | null =>
  localStorage.getItem(NAME_KEY);

// Obtiene el unique_name guardado
export const getUniqueName = (): string | null =>
  localStorage.getItem(UNIQUE_NAME_KEY);

// Obtiene el id token guardado
export const getIdToken = (): string | null =>
  localStorage.getItem(ID_TOKEN_KEY);

// Guarda el id token en localStorage
export const setIdToken = (idToken: string) => {
  localStorage.setItem(ID_TOKEN_KEY, idToken || "");
};

// Extrae el usuario desde un email
const getUserFromEmail = (email: string): string => email.split("@")[0];

// Extrae un username amigable desde la cuenta autenticada
const getUserFromAccount = (account: AccountInfo): string => {
  const email =
    (account.idTokenClaims as any)?.preferred_username || account.username;

  return getUserFromEmail(email);
};

// Obtiene un idToken silenciosamente y actualiza datos del usuario en sesión
export const acquireIdToken = async (
  instance: IPublicClientApplication,
  account: AccountInfo
): Promise<string | null> => {
  try {
    const res = await instance.acquireTokenSilent({
      account,
      scopes: ["openid", "profile", "email"],
    });

    const idTok = (res as any)?.idToken || "";
    setIdToken(idTok);

    const claims = decodeJwtPayload(idTok);

    const name = claims?.name ?? claims?.preferred_username ?? "";
    const uniqueName =
      claims?.unique_name ?? claims?.preferred_username ?? claims?.upn ?? "";

    try {
      if (name) localStorage.setItem(NAME_KEY, name);
      if (uniqueName) localStorage.setItem(UNIQUE_NAME_KEY, uniqueName);
    } catch {}

    return idTok || null;
  } catch {
    return null;
  }
};

// Obtiene un idToken fresco antes de llamar la API. Si no puede renovarlo silenciosamente, retorna null.
export const acquireValidIdToken = async (
  instance: IPublicClientApplication,
  account: AccountInfo
): Promise<string | null> => {
  try {
    const res = await instance.acquireTokenSilent({
      account,
      scopes: ["openid", "profile", "email"],
      forceRefresh: true,
    });

    const idTok = (res as any)?.idToken || "";

    // Si el token no existe o está vencido, no se usa
    if (!idTok || isJwtExpired(idTok, 30)) {
      return null;
    }

    // Guarda token y datos del usuario actualizados
    setIdToken(idTok);

    const claims = decodeJwtPayload(idTok);

    const name = claims?.name ?? claims?.preferred_username ?? "";
    const uniqueName =
      claims?.unique_name ?? claims?.preferred_username ?? claims?.upn ?? "";

    try {
      if (name) localStorage.setItem(NAME_KEY, name);
      if (uniqueName) localStorage.setItem(UNIQUE_NAME_KEY, uniqueName);
    } catch {}

    return idTok;
  } catch (err) {

    // Si MSAL requiere interacción, obliga a nuevo login
    if (err instanceof InteractionRequiredAuthError) {
      return null;
    }

    console.error("[acquireValidIdToken] Error:", err);
    return null;
  }
};

// Obtiene access token para consumir APIs protegidas
export const acquireAccessToken = async (
  instance: IPublicClientApplication,
  account: AccountInfo
): Promise<string | null> => {
  const scopes = (import.meta.env?.VITE_LOGIN_SCOPES || "")
    .split(" ")
    .filter(Boolean);

  const username = getUserFromAccount(account);

  // Si no hay scopes configurados, solo guarda usuario
  if (scopes.length === 0) {
    saveSession("", username);
    return null;
  }

  // Procesa la respuesta del token y actualiza datos del usuario
  const handleTokenResponse = (accessToken: string) => {
    saveSession(accessToken, username);

    const claims = decodeJwtPayload(accessToken);

    const name = claims?.name ?? claims?.preferred_username ?? username;
    const uniqueName =
      claims?.unique_name ?? claims?.preferred_username ?? claims?.upn ?? "";

    try {
      if (name) localStorage.setItem(NAME_KEY, name);
      if (uniqueName) localStorage.setItem(UNIQUE_NAME_KEY, uniqueName);
    } catch {}

    return accessToken || null;
  };

  try {
    
    // Intenta obtener token sin interacción del usuario
    const res = await instance.acquireTokenSilent({ scopes, account });
    return handleTokenResponse(res.accessToken || "");
  } catch (err) {
    // Si requiere interacción, abre popup para pedir token
    if (err instanceof InteractionRequiredAuthError) {
      const res = await instance.acquireTokenPopup({ scopes, account });
      return handleTokenResponse(res.accessToken || "");
    }

    console.error("[acquireAccessToken] Error:", err);
    saveSession("", username);
    return null;
  }
};

// Limpia sesión local y redirige al inicio
export const logoutAndGoHome = async (
  instance: IPublicClientApplication
): Promise<void> => {
  try {
    clearSession();
  } catch {}

  try {
    await instance.logoutRedirect({
      postLogoutRedirectUri: window.location.origin,
    });
  } catch (error) {
    console.error("[logoutAndGoHome] Error:", error);
    window.location.replace("/");
  }
};

// Estructura esperada cuando la validación del token es exitosa
export interface TokenValidationResponse {
  id: string;
  nombre: string;
  email: string | null;
}

// Resultado de la validación del token
export interface TokenValidationResult {
  ok: boolean;
  reason?: string;
  data?: TokenValidationResponse | null;
}

// Valida el idToken contra el backend o servicio validador
export const validateTokenDetailed = async (
  idToken: string
): Promise<TokenValidationResult> => {
  const validationUrl = import.meta.env.VITE_TOKEN_VALIDATION_URL;

  // Verifica que exista URL configurada
  if (!validationUrl) {
    return {
      ok: false,
      reason: "No hay URL de validación configurada (VITE_TOKEN_VALIDATION_URL)",
    };
  }

  // Verifica que sí se recibió token
  if (!idToken) {
    return { ok: false, reason: "No se recibió un ID token para validar" };
  }

  // Si ya expiró localmente, evita consultar el backend
  if (isJwtExpired(idToken, 0)) {
    return {
      ok: false,
      reason: "Tu sesión ha expirado. Por favor vuelve a iniciar sesión.",
    };
  }

  try {
    // Llama al servicio validador enviando el token en Authorization
    const response = await fetch(validationUrl, {
      method: "GET",
      headers: {
        "ngrok-skip-browser-warning": "true",
        Authorization: `Bearer ${idToken}`,
        Accept: "application/json",
      },
    });

    const contentType = response.headers.get("content-type") || "";

    // Si backend respondió con error HTTP
    if (!response.ok) {
      return {
        ok: false,
        reason: `No fue posible validar tu sesión (HTTP ${response.status}).`,
      };
    }

    // Verifica que la respuesta sea JSON
    if (!contentType.toLowerCase().includes("application/json")) {
      return {
        ok: false,
        reason: "El validador devolvió una respuesta no-JSON.",
      };
    }

    const data: any = await response.json();

    // Formato actual esperado del backend
    if ((data?.id ?? null) || (data?.nombre ?? data?.name ?? null)) {
      if (!data?.id && !data?.nombre && !data?.name) {
        return {
          ok: false,
          reason: "Respuesta inválida del validador (faltan id y nombre).",
        };
      }

      const normalized: TokenValidationResponse = {
        id: String(data?.id ?? "N/A"),
        nombre: String(data?.nombre ?? data?.name ?? "N/A"),
        email: data?.email ?? null,
      };

      return { ok: true, data: normalized };
    }

    // Compatibilidad con formato legacy del backend
    if (data?.is_valid?.status === "OK") {
      const nombre = data?.is_valid?.nombre ?? data?.is_valid?.name ?? "N/A";
      const id = data?.is_valid?.id ?? "N/A";
      const email = data?.is_valid?.email ?? null;

      if (!data?.is_valid?.id && !data?.is_valid?.name && !data?.is_valid?.nombre) {
        return {
          ok: false,
          reason: "Respuesta inválida del validador (legacy sin id ni nombre).",
        };
      }

      return { ok: true, data: { id, nombre, email } };
    }

    // Si la estructura no coincide con ningún formato conocido
    return { ok: false, reason: "Respuesta desconocida del validador." };
  } catch (error) {
    console.error("[validateTokenDetailed] Error:", error);

    // Error de red o fallo inesperado
    return { ok: false, reason: "Error de red al validar tu sesión." };
  }
};
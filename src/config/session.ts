import type { AccountInfo, IPublicClientApplication } from "@azure/msal-browser";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

/* ====== STORAGE KEYS ====== */
const ACCESS_TOKEN_KEY = "access_token";
const USERNAME_KEY     = "username";
const ID_TOKEN_KEY     = "id_token";
const NAME_KEY         = "name";
const UNIQUE_NAME_KEY  = "unique_name";

/* ====== HELPERS JWT (decodificar, solo lectura) ====== */
function decodeJwtPayload(token: string): any | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;

    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded =
      base64.length % 4 === 2 ? base64 + "==" :
      base64.length % 4 === 3 ? base64 + "="  : base64;

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

function isJwtExpired(token: string, skewSec = 60): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return now + skewSec >= Number(payload.exp);
}

/* ====== BASIC SESSION ====== */
export const saveSession = (accessToken: string, username: string) => {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken || "");
  localStorage.setItem(USERNAME_KEY, username);
};

export const clearSession = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
  localStorage.removeItem(ID_TOKEN_KEY);
  localStorage.removeItem(NAME_KEY);
  localStorage.removeItem(UNIQUE_NAME_KEY);
};

export const getAccessToken = (): string | null => localStorage.getItem(ACCESS_TOKEN_KEY);
export const getUsername   = (): string | null => localStorage.getItem(USERNAME_KEY);
export const getName       = (): string | null => localStorage.getItem(NAME_KEY);
export const getUniqueName = (): string | null => localStorage.getItem(UNIQUE_NAME_KEY);
export const getIdToken    = (): string | null => localStorage.getItem(ID_TOKEN_KEY);

export const setIdToken = (idToken: string) => {
  localStorage.setItem(ID_TOKEN_KEY, idToken || "");
};

/* ====== UTILIDADES DE CUENTA ====== */
const getUserFromEmail = (email: string): string => email.split("@")[0];

const getUserFromAccount = (account: AccountInfo): string => {
  const email =
    (account.idTokenClaims as any)?.preferred_username ||
    account.username;
  return getUserFromEmail(email);
};

/* ====== ID TOKEN (opcional, refrescar) ====== */
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
    const name =
      claims?.name ??
      claims?.preferred_username ??
      "";
    const uniqueName =
      claims?.unique_name ??
      claims?.preferred_username ??
      claims?.upn ??
      "";

    try {
      if (name)       localStorage.setItem(NAME_KEY, name);
      if (uniqueName) localStorage.setItem(UNIQUE_NAME_KEY, uniqueName);
    } catch {}
    return idTok || null;
  } catch {
    return null;
  }
};

/* ====== ACCESS TOKEN (opcional) ====== */
export const acquireAccessToken = async (
  instance: IPublicClientApplication,
  account: AccountInfo
): Promise<string | null> => {
  const scopes = (import.meta.env?.VITE_LOGIN_SCOPES || "")
    .split(" ")
    .filter(Boolean);
  const username = getUserFromAccount(account);

  if (scopes.length === 0) {
    saveSession("", username);
    return null;
  }

  const handleTokenResponse = (accessToken: string) => {
    saveSession(accessToken, username);

    const claims = decodeJwtPayload(accessToken);
    const name =
      claims?.name ??
      claims?.preferred_username ??
      username;

    const uniqueName =
      claims?.unique_name ??
      claims?.preferred_username ??
      claims?.upn ??
      "";

    try {
      if (name)       localStorage.setItem(NAME_KEY, name);
      if (uniqueName) localStorage.setItem(UNIQUE_NAME_KEY, uniqueName);
    } catch {}
    return accessToken || null;
  };

  try {
    const res = await instance.acquireTokenSilent({ scopes, account });
    return handleTokenResponse(res.accessToken || "");
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      const res = await instance.acquireTokenPopup({ scopes, account });
      return handleTokenResponse(res.accessToken || "");
    }
    console.error("[acquireAccessToken] Error:", err);
    saveSession("", username);
    return null;
  }
};

/* ====== VALIDACIÓN DE TOKEN (GET + Bearer, con resultado detallado) ====== */
export interface TokenValidationResponse {
  id: string;
  nombre: string;
  email: string | null;
}

export interface TokenValidationResult {
  ok: boolean;
  reason?: string; // texto para mostrar al usuario/log
  data?: TokenValidationResponse | null;
}

/**
 * Valida un ID token con el contrato actual:
 *   - GET + Authorization: Bearer <ID_TOKEN>
 *   - Respuesta JSON: { id, nombre, email } | (compat) { is_valid: { status:"OK", name? } }
 * NO cierra sesión aquí. Devuelve { ok, reason, data } y que la UI decida.
 */
export const validateTokenDetailed = async (idToken: string): Promise<TokenValidationResult> => {
  const validationUrl = import.meta.env.VITE_TOKEN_VALIDATION_URL;
  if (!validationUrl) {
    return { ok: false, reason: "No hay URL de validación configurada (VITE_TOKEN_VALIDATION_URL)" };
  }
  if (!idToken) {
    return { ok: false, reason: "No se recibió un ID token para validar" };
  }

  // Exp local (sirve para QA con token vencido)
  if (isJwtExpired(idToken, 0)) {
    return { ok: false, reason: "Tu sesión ha expirado. Por favor vuelve a iniciar sesión." };
  }

  try {
    const response = await fetch(validationUrl, {
      method: "GET",
      headers: {
        "ngrok-skip-browser-warning": "true",
        "Authorization": `Bearer ${idToken}`,
        "Accept": "application/json",
      },
    });

    const contentType = response.headers.get("content-type") || "";
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        ok: false,
        reason: `No fue posible validar tu sesión (HTTP ${response.status}).`,
      };
    }

    if (!contentType.toLowerCase().includes("application/json")) {
      return {
        ok: false,
        reason: "El validador devolvió una respuesta no-JSON.",
      };
    }

    const data: any = await response.json();

    // Contrato nuevo: { id, nombre, email }
    if ((data?.id ?? null) || (data?.nombre ?? data?.name ?? null)) {
      if ((!data?.id) && (!data?.nombre && !data?.name)) {
        return { ok: false, reason: "Respuesta inválida del validador (faltan id y nombre)." };
      }
      const normalized: TokenValidationResponse = {
        id: String(data?.id ?? "N/A"),
        nombre: String(data?.nombre ?? data?.name ?? "N/A"),
        email: data?.email ?? null,
      };
      return { ok: true, data: normalized };
    }

    // Compat legado: { is_valid: { status:"OK", name? } }
    if (data?.is_valid?.status === "OK") {
      const nombre = data?.is_valid?.nombre ?? data?.is_valid?.name ?? "N/A";
      const id     = data?.is_valid?.id     ?? "N/A";
      const email  = data?.is_valid?.email  ?? null;
      if ((!data?.is_valid?.id) && (!data?.is_valid?.name && !data?.is_valid?.nombre)) {
        return { ok: false, reason: "Respuesta inválida del validador (legacy sin id ni nombre)." };
      }
      return { ok: true, data: { id, nombre, email } };
    }

    return { ok: false, reason: "Respuesta desconocida del validador." };
  } catch (error) {
    console.error("[validateTokenDetailed] Error:", error);
    return { ok: false, reason: "Error de red al validar tu sesión." };
  }
};

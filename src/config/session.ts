/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-empty */
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

// Obtiene datos almacenados
export const getAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);
export const getUsername = () => localStorage.getItem(USERNAME_KEY);
export const getName = () => localStorage.getItem(NAME_KEY);
export const getUniqueName = () => localStorage.getItem(UNIQUE_NAME_KEY);
export const getIdToken = () => localStorage.getItem(ID_TOKEN_KEY);

// Guarda el id token
export const setIdToken = (idToken: string) => {
  localStorage.setItem(ID_TOKEN_KEY, idToken || "");
};

// Extrae usuario desde email
const getUserFromEmail = (email: string): string => email.split("@")[0];

// Extrae username amigable
const getUserFromAccount = (account: AccountInfo): string => {
  const email =
    (account.idTokenClaims as any)?.preferred_username || account.username;

  return getUserFromEmail(email);
};

// Obtiene idToken y actualiza datos de sesión
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

// Obtiene access token para APIs protegidas
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

// Logout
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
import type { AccountInfo, IPublicClientApplication } from "@azure/msal-browser";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

/* ====== STORAGE KEYS ====== */
const ACCESS_TOKEN_KEY = "access_token";
const USERNAME_KEY = "username";
const ID_TOKEN_KEY = "id_token";
const NAME_KEY = "name";
const UNIQUE_NAME_KEY = "unique_name";
const TOKEN_VALID_KEY = "token_valid";

/* ====== CONFIG ====== */
const VALIDATION_URL = (import.meta.env.VITE_TOKEN_VALIDATION_URL as string)
    || "https://3b0a-206-84-81-141.ngrok-free.app/validate_token";

/* ====== HELPERS JWT (decodificar, solo lectura) ====== */
function decodeJwtPayload(token: string): any | null {
    try {
        const base64Url = token.split(".")[1];
        if (!base64Url) return null;

        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const padded =
            base64.length % 4 === 2 ? base64 + "==" :
                base64.length % 4 === 3 ? base64 + "=" : base64;

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
    localStorage.removeItem(TOKEN_VALID_KEY);
};

export const getAccessToken = (): string | null => localStorage.getItem(ACCESS_TOKEN_KEY);
export const getUsername = (): string | null => localStorage.getItem(USERNAME_KEY);
export const getName = (): string | null => localStorage.getItem(NAME_KEY);
export const getUniqueName = (): string | null => localStorage.getItem(UNIQUE_NAME_KEY);
export const getIdToken = (): string | null => localStorage.getItem(ID_TOKEN_KEY);

export const setIdToken = (idToken: string) => {
    localStorage.setItem(ID_TOKEN_KEY, idToken || "");
};
export const setTokenValidated = (ok: boolean) => {
    localStorage.setItem(TOKEN_VALID_KEY, ok ? "true" : "false");
};
export const isTokenValidated = (): boolean => {
    return localStorage.getItem(TOKEN_VALID_KEY) === "true";
};

/* ====== UTILIDADES DE CUENTA ====== */
const getUserFromEmail = (email: string): string => email.split("@")[0];

const getUserFromAccount = (account: AccountInfo): string => {
    const email =
        (account.idTokenClaims as any)?.preferred_username ||
        account.username;
    return getUserFromEmail(email);
};

/* ====== Validación externa del ID TOKEN ====== */
/** Clasifica la respuesta
 *  - {ok:true, denied:false}  => validación OK
 *  - {ok:false, denied:true}  => validación negativa explícita (status ≠ OK)
 *  - {ok:false, transient:true} => error transitorio (red/CORS/timeouts...)
 */
export async function validateIdTokenExternal(idToken: string): Promise<{ ok: boolean; denied?: boolean; transient?: boolean; name?: string }> {
    try {
        const res = await fetch(VALIDATION_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: idToken }),
        });

        if (!res.ok) {
            // Error HTTP ≠ rechazo explícito; lo tratamos como transitorio
            return { ok: false, transient: true };
        }

        const data = await res.json();
        const ok = data?.is_valid?.status === "OK";
        const name = data?.is_valid?.name as string | undefined;

        if (ok) {
            setTokenValidated(true);
            if (name) {
                try { localStorage.setItem(NAME_KEY, name); } catch { }
            }
            return { ok: true, denied: false, name };
        } else {
            setTokenValidated(false);
            return { ok: false, denied: true };
        }
    } catch (e) {
        console.warn("[validateIdTokenExternal] Error transitorio:", e);
        return { ok: false, transient: true };
    }
}

/** Reintento con backoff exponencial: 0ms, 600ms, 1200ms (por defecto) */
export async function validateIdTokenWithRetry(idToken: string, maxAttempts = 3) {
    const delays = [0, 600, 1200];
    for (let i = 0; i < Math.min(maxAttempts, delays.length); i++) {
        if (delays[i]) await new Promise(r => setTimeout(r, delays[i]));
        const r = await validateIdTokenExternal(idToken);
        if (r.ok) return { ok: true, denied: false };
        if (r.denied) return { ok: false, denied: true };   // rechazo explícito → no insistir
        // si fue transitorio: continúa el loop
    }
    return { ok: false, denied: false }; // agotó intentos (transitorio persistente)
}

/* ====== ACCESS TOKEN: obtenerlo y poblar name / unique_name desde sus claims ====== */
export const acquireAccessToken = async (
    instance: IPublicClientApplication,
    account: AccountInfo
): Promise<string | null> => {

    const scopes = (import.meta.env.VITE_LOGIN_SCOPES || "").split(" ").filter(Boolean);
    const username = getUserFromAccount(account);

    if (scopes.length === 0) {
        // Sin scopes no habrá access token (solo ID token)
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
            if (name) localStorage.setItem(NAME_KEY, name);
            if (uniqueName) localStorage.setItem(UNIQUE_NAME_KEY, uniqueName);
        } catch { }

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
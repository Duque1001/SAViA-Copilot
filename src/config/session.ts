import type { AccountInfo, IPublicClientApplication } from "@azure/msal-browser";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

/* ====== STORAGE KEYS ====== */
const ACCESS_TOKEN_KEY = "access_token";
const USERNAME_KEY = "username";
const ID_TOKEN_KEY = "id_token";
const NAME_KEY = "name";
const UNIQUE_NAME_KEY = "unique_name";

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
};

export const getAccessToken = (): string | null => localStorage.getItem(ACCESS_TOKEN_KEY);
export const getUsername = (): string | null => localStorage.getItem(USERNAME_KEY);
export const getName = (): string | null => localStorage.getItem(NAME_KEY);
export const getUniqueName = (): string | null => localStorage.getItem(UNIQUE_NAME_KEY);
export const getIdToken = (): string | null => localStorage.getItem(ID_TOKEN_KEY);

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

/* ====== ID TOKEN: obtenerlo y guardarlo (para usos posteriores) ====== */
export const acquireIdToken = async (
    instance: IPublicClientApplication,
    account: AccountInfo
): Promise<string | null> => {
    try {
        const res = await instance.acquireTokenSilent({
            account,
            scopes: ["openid", "profile", "email"],
        });
        const idTok = res.idToken || "";
        setIdToken(idTok);
        // Opcional: puedes poblar NAME/UNIQUE_NAME desde el idToken
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
            if (name) localStorage.setItem(NAME_KEY, name);
            if (uniqueName) localStorage.setItem(UNIQUE_NAME_KEY, uniqueName);
        } catch { }
        return idTok || null;
    } catch {
        // En caso de que no esté en caché, podrías forzar una interacción:
        // const res = await instance.acquireTokenPopup({ account, scopes: ["openid","profile","email"] });
        // setIdToken(res.idToken || "");
        return null;
    }
};

/* ====== ACCESS TOKEN: obtenerlo y poblar name / unique_name desde sus claims ====== */
export const acquireAccessToken = async (
    instance: IPublicClientApplication,
    account: AccountInfo
): Promise<string | null> => {
    const scopes = (import.meta.env?.VITE_LOGIN_SCOPES || "")
        .split(" ")
        .filter(Boolean);
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


/* ====== VALIDACIÓN DE TOKEN CON API EXTERNA ====== */

export interface TokenValidationResponse {
    id: string;
    nombre: string;
    email: string | null;
}

export const validateToken = async (idToken: string): Promise<TokenValidationResponse | null> => {
    const validationUrl = import.meta.env.VITE_TOKEN_VALIDATION_URL;


    if (!validationUrl || !idToken) {
        console.error("[validateToken] URL o token faltante");
        return null;
    }

    try {
        const response = await fetch(validationUrl, {
            method: "GET",
            headers: {
                Authorization: `Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6Ino2LWZMdjIyM1BXNG42UjNneHZkdlhpZ1pYayJ9.eyJhdWQiOiI3MDE1OTYyMi0zY2IzLTQ3NTAtYjZhNy0xMzkzNjEyOWJjNDEiLCJpc3MiOiJodHRwczovLzRiMjc1YzI4LTU1MTMtNDk3YS04YzUwLTZjYjAzNDc3ZjVkZi5jaWFtbG9naW4uY29tLzRiMjc1YzI4LTU1MTMtNDk3YS04YzUwLTZjYjAzNDc3ZjVkZi92Mi4wIiwiaWF0IjoxNzcyMTQzMzk2LCJuYmYiOjE3NzIxNDMzOTYsImV4cCI6MTc3MjE0NzI5NiwiYWlvIjoiQVlRQWUvOGJBQUFBK3Ara0NBdWtEcDhNZE83b3NYSFFremQ5M1BuVHgyZ1psV3FyRFFBR1pYWTBSN2dPbEZQRTcrZHRHN3FiVzFyYkhUVjJwVnFOY1R3NDQ5WVJnOVRkVWcveVl2T3ExY1pBeWI3NSttWitDdnBjSUFLWVc3M0FGUDB5bzcvaTA1VFAxeEx0V1dMeTJPeTBTSjd1Y3dhcm5seUJ4WVhldHlDQnZKZHlmSzd5aWd3PSIsIm5hbWUiOiJBbmRlcnNzb24gSGVuYW8gT2NhbXBvIiwib2lkIjoiNDY5YmJiMTctYmEwYy00ODk0LWI4OTEtZDhhZjY0ZjhkNWEwIiwicmgiOiIxLkFiZ0FLRnduU3hOVmVrbU1VR3l3TkhmMTN5S1dGWEN6UEZCSHRxY1RrMkVwdkVFQUFNYTRBQS4iLCJzaWQiOiIwMDIyODQwYS1mNjExLWNjZTMtZTcwOS1hN2ZmMjA4YTYxYTMiLCJzdWIiOiJMUUFFQkQ2ckVTaHUwWTB4dkdYX000WXBRdV9QUHp4UTBiX0tOQ3dQdnl3IiwidGlkIjoiNGIyNzVjMjgtNTUxMy00OTdhLThjNTAtNmNiMDM0NzdmNWRmIiwidXRpIjoiaGdFZlk5cXFqay1ONlhhai1VVUFBQSIsInZlciI6IjIuMCJ9.fopJgc4rE4tNknOWMzRoDOVXnLTodR1Y7nrMrqQnPifnDbYIYIkk8IgSIHZtFQTOgEg5X2eJraqfGsaOmQm8OMxPN_FTpULfF6yh2Zjin-5VkKhNBJS6woLrTZM0rIqAtDqZkgID05YG_fWOgtnQJRx5ekBQ76GVVT7DqayDtmJ8-Zdmgjktsko9Tm_I5kn8I9FKliAVrUIFZ_yCWm421ZrzyUyfPQvIUbNb7s7DkYWDjZf_2GDo4pcONh-05xiAje2UMpEkfe3JSZVd3PlAzvjNLZSACQUfm58ojveLfaMmDVkEKtMPGAkCt2T3YsR2gc8RJ7gyWw-jEokBdNJHIw`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            console.warn(`[validateToken] HTTP ${response.status}`);
            return null;
        }

        const data: TokenValidationResponse = await response.json();

        if (!data?.id || !data?.nombre) {
            console.warn("[validateToken] Respuesta sin campos esperados:", data);
            return null;
        }

        return data;
    } catch (error) {
        console.error("[validateToken] Error:", error);
        return null;
    }
};
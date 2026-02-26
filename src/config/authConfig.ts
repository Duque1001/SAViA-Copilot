

/* 🔐 CONFIGURACIÓN MSAL (CIAM) */

// ⚠️ Requiere estas variables en .env:
// VITE_ENTRA_CLIENT_ID=70159622-3cb3-4750-b6a7-13936129bc41
// VITE_ENTRA_TENANT_ID=4b275c28-5513-497a-8c50-6cb03477f5df  // tu GUID
// VITE_ENTRA_CIAM_DOMAIN=saviabaseconocimiento.ciamlogin.com  // NUEVA (dominio CIAM)
// VITE_API_SCOPE=api://.../.default (opcional; si la usas para tu backend)

const CLIENT_ID = import.meta.env.VITE_ENTRA_CLIENT_ID as string;
const TENANT_ID = import.meta.env.VITE_ENTRA_TENANT_ID as string; // GUID
const CIAM_DOMAIN = import.meta.env.VITE_ENTRA_CIAM_DOMAIN as string; // p.ej. saviabaseconocimiento.ciamlogin.com

if (!CLIENT_ID) throw new Error("VITE_ENTRA_CLIENT_ID no está definida");
if (!TENANT_ID) throw new Error("VITE_ENTRA_TENANT_ID no está definida");
if (!CIAM_DOMAIN) throw new Error("VITE_ENTRA_CIAM_DOMAIN no está definida");

// Authority CIAM específica de tu tenant (no login.microsoftonline.com)
const AUTHORITY = `https://${CIAM_DOMAIN}/${TENANT_ID}/`;

// Redirects en local
//const REDIRECT_URI = "http://localhost:3000";
//const POST_LOGOUT_REDIRECT_URI = "http://localhost:3000";

//PRD
const REDIRECT_URI = "https://blue-desert-007337e10.1.azurestaticapps.net/";
const POST_LOGOUT_REDIRECT_URI = "https://blue-desert-007337e10.1.azurestaticapps.net/";

export const msalConfig = {
    auth: {
        clientId: CLIENT_ID,
        authority: AUTHORITY,
        knownAuthorities: [CIAM_DOMAIN], // requerido en B2C/CIAM para confiar en el emisor
        redirectUri: REDIRECT_URI,
        postLogoutRedirectUri: POST_LOGOUT_REDIRECT_URI,
    },
    cache: {
        cacheLocation: "localStorage",
        // storeAuthStateInCookie: false, // ❌ quitar: ya no existe en MSAL browser actual
    },
};

/* 🔑 SCOPES
   - Por defecto OIDC para sesión en la SPA: openid profile
   - Si defines VITE_API_SCOPE, lo añadimos para acquireToken (tu sesión/llamadas API)
*/
const defaultScopes = ["openid", "profile"];
const maybeApiScope = import.meta.env.VITE_API_SCOPE as string | undefined;

export const loginRequest = {
    scopes: maybeApiScope ? [...defaultScopes, maybeApiScope] : defaultScopes,
};
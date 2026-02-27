/* CONFIGURACIÓN MSAL */

// ENV requeridas
const CLIENT_ID = import.meta.env.VITE_ENTRA_CLIENT_ID as string;
const TENANT_ID = import.meta.env.VITE_ENTRA_TENANT_ID as string;
const CIAM_DOMAIN = import.meta.env.VITE_ENTRA_CIAM_DOMAIN as string;

if (!CLIENT_ID) throw new Error("VITE_ENTRA_CLIENT_ID no está definida");
if (!TENANT_ID) throw new Error("VITE_ENTRA_TENANT_ID no está definida");
if (!CIAM_DOMAIN) throw new Error("VITE_ENTRA_CIAM_DOMAIN no está definida");

const AUTHORITY = `https://${CIAM_DOMAIN}/${TENANT_ID}/`;

const REDIRECT_URI =
    (import.meta.env.VITE_REDIRECT_URI as string) || window.location.origin;

const POST_LOGOUT_REDIRECT_URI =
    (import.meta.env.VITE_POST_LOGOUT_REDIRECT_URI as string) ||
    window.location.origin;

export const msalConfig = {
    auth: {
        clientId: CLIENT_ID,
        authority: AUTHORITY,
        knownAuthorities: [CIAM_DOMAIN],
        redirectUri: REDIRECT_URI,
        postLogoutRedirectUri: POST_LOGOUT_REDIRECT_URI,
    },
    cache: {
        cacheLocation: "localStorage",
    },
};

/* Scopes que determinan el ACCESS TOKEN que recibimos */
export const loginRequest = {
    scopes: (import.meta.env.VITE_LOGIN_SCOPES || "openid profile").split(" "),
};
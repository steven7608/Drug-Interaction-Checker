// Simple Supabase REST/AUTH helper (no external libs)
// Configure with your project settings
const supabaseUrl = "https://zsghiwxyahwsogcmouny.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzZ2hpd3h5YWh3c29nY21vdW55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NTMxNjksImV4cCI6MjA3NTQyOTE2OX0.3BpLsHGkPDV2cLCWhtUpGaKOJB-1Y0mxRaD5yO4P-Cs";

function supabaseAuthSignUp(email, password, redirectTo) {
    return fetch(`${supabaseUrl}/auth/v1/signup`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "apikey": supabaseAnonKey,
        },
        body: JSON.stringify({ email, password, options: redirectTo ? { emailRedirectTo: redirectTo } : undefined })
    }).then(r => r.json());
}

function supabaseAuthSignIn(email, password) {
    return fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "apikey": supabaseAnonKey,
        },
        body: JSON.stringify({ email, password })
    }).then(r => r.json());
}

function supabaseRequest({ method = "GET", path, body = undefined, accessToken = undefined, query = "" }) {
    const headers = {
        "apikey": supabaseAnonKey,
        "Accept": "application/json",
    };
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const url = `${supabaseUrl}/rest/v1/${path}${query}`;
    return fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    }).then(async (r) => {
        const text = await r.text();
        let data = null;
        try { data = text ? JSON.parse(text) : null; } catch {}
        if (!r.ok) {
            const msg = (data && (data.message || data.error_description || data.error)) || r.statusText;
            throw new Error(msg);
        }
        return data;
    });
}

function saveSession(session, email) {
    if (!session) return;
    if (session.access_token) localStorage.setItem("sbAccessToken", session.access_token);
    if (session.refresh_token) localStorage.setItem("sbRefreshToken", session.refresh_token);
    if (email) localStorage.setItem("sbEmail", email);
}

function getAccessToken() {
    return localStorage.getItem("sbAccessToken");
}

function getEmail() {
    return localStorage.getItem("sbEmail");
}

function clearSession() {
    localStorage.removeItem("sbAccessToken");
    localStorage.removeItem("sbRefreshToken");
    localStorage.removeItem("sbEmail");
}

// Lightweight JWT decoder (no validation, just base64 decode)
function decodeJwt(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const decoded = atob(payload);
        return JSON.parse(decoded);
    } catch (_) { return null; }
}

function generateUserId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'u_' + Math.random().toString(36).slice(2, 10);
}



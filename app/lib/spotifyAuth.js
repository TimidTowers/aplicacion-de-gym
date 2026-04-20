// Autenticación OAuth 2.0 con PKCE para Spotify — sin backend.
// Doc: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow

const SCOPES = [
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'streaming',
  'playlist-read-private',
  'playlist-read-collaborative',
].join(' ');

const VERIFIER_KEY = 'spotify_pkce_verifier';
const PENDING_KEY = 'spotify_pkce_pending'; // marca que iniciamos auth, para procesar callback

function base64UrlEncode(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(digest);
}

function randomVerifier() {
  const arr = new Uint8Array(64);
  crypto.getRandomValues(arr);
  return base64UrlEncode(arr);
}

export function getRedirectUri() {
  if (typeof window === 'undefined') return '';
  return window.location.origin + '/';
}

// Redirige al login de Spotify. Se guarda el code_verifier en localStorage
// (debe sobrevivir al reload del callback).
export async function startSpotifyAuth(clientId) {
  if (!clientId) throw new Error('Client ID requerido');
  const verifier = randomVerifier();
  const challenge = base64UrlEncode(await sha256(verifier));
  localStorage.setItem(VERIFIER_KEY, verifier);
  localStorage.setItem(PENDING_KEY, '1');
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });
  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

// Si venimos de un callback (?code=...) intercambia el código por tokens.
// Devuelve { access_token, refresh_token, expires_in, ... } o null si no hay callback pendiente.
export async function consumeCallback(clientId) {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');
  const pending = localStorage.getItem(PENDING_KEY);
  if (!pending) return null;
  localStorage.removeItem(PENDING_KEY);
  // Limpiar URL (evita reprocesar al refrescar)
  const cleanUrl = window.location.origin + window.location.pathname;
  window.history.replaceState({}, '', cleanUrl);
  if (error) throw new Error(`Spotify devolvió error: ${error}`);
  if (!code) return null;
  const verifier = localStorage.getItem(VERIFIER_KEY);
  if (!verifier) throw new Error('Falta code_verifier — reintenta la conexión');
  localStorage.removeItem(VERIFIER_KEY);

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: getRedirectUri(),
    code_verifier: verifier,
  });
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Token exchange falló (${r.status}): ${t}`);
  }
  return r.json();
}

export async function refreshAccessToken(clientId, refreshToken) {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!r.ok) throw new Error(`Refresh falló (${r.status})`);
  return r.json();
}

export async function getMe(accessToken) {
  const r = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error('GET /me falló');
  return r.json();
}

// Helper: wraps una llamada API con refresh automático si el token expiró.
// `tokenState` = { accessToken, refreshToken, expiresAt }. Puede mutar (se devuelve nuevo).
export async function withFreshToken(clientId, tokenState, fn) {
  let state = tokenState;
  if (!state?.accessToken) throw new Error('No autenticado');
  // Refresh si vence en <60 s
  if (!state.expiresAt || state.expiresAt - Date.now() < 60_000) {
    const r = await refreshAccessToken(clientId, state.refreshToken);
    state = {
      accessToken: r.access_token,
      refreshToken: r.refresh_token || state.refreshToken,
      expiresAt: Date.now() + r.expires_in * 1000,
    };
  }
  const result = await fn(state.accessToken);
  return { state, result };
}

// Wrappers de Spotify Web API (Connect) — controlan playback del dispositivo activo.
// Todos reciben el access_token como primer argumento.

async function spFetch(accessToken, method, path, body) {
  const r = await fetch(`https://api.spotify.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  // 204 = éxito sin cuerpo (play, pause, next, prev)
  if (r.status === 204) return null;
  if (r.status === 404) {
    const t = await r.text();
    const err = new Error(t || 'No active device');
    err.code = 'NO_ACTIVE_DEVICE';
    throw err;
  }
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Spotify ${r.status}: ${t}`);
  }
  const ct = r.headers.get('content-type') || '';
  return ct.includes('json') ? r.json() : null;
}

export async function getDevices(token) {
  return spFetch(token, 'GET', '/me/player/devices');
}

export async function getPlaybackState(token) {
  const r = await fetch('https://api.spotify.com/v1/me/player', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (r.status === 204) return null; // nada reproduciendo
  if (!r.ok) throw new Error(`Spotify ${r.status}`);
  return r.json();
}

// Inicia/transfiere reproducción. `contextUri` es spotify:playlist:XXX etc.
export async function play(token, { deviceId, contextUri, uris, positionMs } = {}) {
  const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
  const body = {};
  if (contextUri) body.context_uri = contextUri;
  if (uris) body.uris = uris;
  if (positionMs != null) body.position_ms = positionMs;
  return spFetch(token, 'PUT', `/me/player/play${query}`, Object.keys(body).length ? body : undefined);
}

export async function pause(token, deviceId) {
  const q = deviceId ? `?device_id=${deviceId}` : '';
  return spFetch(token, 'PUT', `/me/player/pause${q}`);
}

export async function next(token, deviceId) {
  const q = deviceId ? `?device_id=${deviceId}` : '';
  return spFetch(token, 'POST', `/me/player/next${q}`);
}

export async function previous(token, deviceId) {
  const q = deviceId ? `?device_id=${deviceId}` : '';
  return spFetch(token, 'POST', `/me/player/previous${q}`);
}

export async function setVolume(token, volumePercent, deviceId) {
  const q = new URLSearchParams({ volume_percent: String(Math.round(volumePercent)) });
  if (deviceId) q.set('device_id', deviceId);
  return spFetch(token, 'PUT', `/me/player/volume?${q.toString()}`);
}

// Transfiere la reproducción a un dispositivo sin empezar una nueva
export async function transfer(token, deviceId, playAfter = false) {
  return spFetch(token, 'PUT', '/me/player', { device_ids: [deviceId], play: playAfter });
}

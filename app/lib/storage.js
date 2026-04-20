// Capa de persistencia basada en localStorage por perfil.
// Cada perfil tiene su propio espacio de datos.

const APP_KEY = 'gym-tracker-v1';

const safe = {
  get: (k) => {
    if (typeof window === 'undefined') return null;
    try { return localStorage.getItem(k); } catch { return null; }
  },
  set: (k, v) => {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(k, v); } catch {}
  },
  remove: (k) => {
    if (typeof window === 'undefined') return;
    try { localStorage.removeItem(k); } catch {}
  },
};

export function loadRoot() {
  const raw = safe.get(APP_KEY);
  if (!raw) return { profiles: {}, currentProfile: null };
  try {
    const data = JSON.parse(raw);
    return { profiles: data.profiles || {}, currentProfile: data.currentProfile || null };
  } catch {
    return { profiles: {}, currentProfile: null };
  }
}

export function saveRoot(root) {
  safe.set(APP_KEY, JSON.stringify(root));
}

export function emptyProfile(name, routineId) {
  return {
    name,
    routineId,
    createdAt: new Date().toISOString(),
    week: 1,
    checks: {},
    weights: {},
    streak: 0,
    totalCompleted: 0,
    history: [],
    // Rutinas personalizadas creadas/duplicadas por el usuario
    customRoutines: {},
    // Datos corporales — todo opcional
    body: {
      height: null,     // cm
      age: null,        // años
      sex: null,        // 'male' | 'female'
      activity: 1.55,   // factor actividad (por defecto: moderado)
      measurements: [], // [{ week, date, weight, bodyFat? }]
    },
    // Música — integración Spotify (opcional)
    music: {
      enabled: false,
      playlistUrl: '',           // URL o URI de Spotify (playlist/álbum/etc.)
      autoplayOnStart: true,     // reproducir al tocar HOY / expandir día
      clientId: '',              // Client ID de la app de Spotify del usuario
      oauth: null,               // { accessToken, refreshToken, expiresAt, displayName, product, email }
    },
  };
}

export function exportData() {
  const root = loadRoot();
  return JSON.stringify(root, null, 2);
}

export function importData(json) {
  const data = JSON.parse(json);
  if (!data.profiles) throw new Error('Formato inválido');
  saveRoot(data);
  return data;
}

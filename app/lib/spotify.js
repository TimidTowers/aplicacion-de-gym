// Utilidades para integración con Spotify (sin OAuth — usa embed iframe público).
// Soporta URLs de playlist, album, track, artist o URIs spotify:*:id.

const RE = /(?:open\.spotify\.com\/(?:intl-\w+\/)?|spotify:(?:embed[/:])?)(playlist|album|track|artist|show|episode)s?[/:]([A-Za-z0-9]+)/i;

// Parsea una URL/URI de Spotify → { type, id } o null si no es válida.
export function parseSpotify(input) {
  if (!input || typeof input !== 'string') return null;
  const m = input.match(RE);
  if (!m) return null;
  return { type: m[1].toLowerCase(), id: m[2] };
}

// Construye la URI canónica (formato usado por el IFrame API)
export function toSpotifyUri(parsed) {
  if (!parsed) return null;
  return `spotify:${parsed.type}:${parsed.id}`;
}

// Construye la URL pública del embed
export function toEmbedUrl(parsed) {
  if (!parsed) return null;
  return `https://open.spotify.com/embed/${parsed.type}/${parsed.id}?utm_source=generator&theme=0`;
}

// URL abierta de Spotify — abre la app nativa en móvil si está instalada
export function toOpenUrl(parsed) {
  if (!parsed) return null;
  return `https://open.spotify.com/${parsed.type}/${parsed.id}`;
}

// Etiqueta legible: "Playlist · 4gH...k"
export function describe(parsed) {
  if (!parsed) return 'No configurado';
  const types = { playlist: 'Playlist', album: 'Álbum', track: 'Canción', artist: 'Artista', show: 'Podcast', episode: 'Episodio' };
  return `${types[parsed.type] || parsed.type} · ${parsed.id.slice(0, 8)}…`;
}

// Validación rápida
export function isValid(input) {
  return parseSpotify(input) != null;
}

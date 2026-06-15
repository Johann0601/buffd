// Spotify-Anbindung fürs Musik-Widget. Login über den modernen PKCE-Flow
// (Authorization Code mit Code-Verifier — KEIN Client-Secret nötig, daher für
// eine Desktop-App geeignet). Der Autorisierungs-Code wird automatisch über
// einen kurzlebigen lokalen Server (127.0.0.1:8888) eingefangen.
//
// Voraussetzung: eine bei Spotify registrierte App (Client-ID) mit der
// Redirect-URI http://127.0.0.1:8888/callback. Steuern (Play/Pause/Skip)
// erfordert Spotify Premium und ein aktives Wiedergabegerät.

import { app, safeStorage, shell } from 'electron'
import { createHash, randomBytes } from 'crypto'
import { createServer } from 'http'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { SpotifyState, SpotifyStatus } from '@shared/types'
import { getStoredKey, setStoredKey } from './keys'
import { BUILTIN_SPOTIFY_CLIENT_ID } from './builtinKeys'

const REDIRECT_PORT = 8888
const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/callback`
const SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing'
const AUTH_URL = 'https://accounts.spotify.com/authorize'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const API = 'https://api.spotify.com/v1'

function clientId(): string | null {
  // Eigene (in Konten hinterlegte) ID hätte Vorrang; sonst die eingebaute.
  return getStoredKey('spotifyClientId') ?? BUILTIN_SPOTIFY_CLIENT_ID
}

// --- Token-Speicherung (verschlüsselt, wie beim Epic-Konto) ------------------

interface StoredAuth {
  refreshToken: string
  displayName: string
}
let accessToken: string | null = null
let accessTokenExpiresAt = 0
let cachedAuth: StoredAuth | null | undefined

function authFilePath(): string {
  return join(app.getPath('userData'), 'spotify-account.bin')
}
function saveAuth(auth: StoredAuth): void {
  const raw = JSON.stringify(auth)
  const data = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(raw)
    : Buffer.from(raw, 'utf8')
  writeFileSync(authFilePath(), data)
  cachedAuth = auth
}
function loadAuth(): StoredAuth | null {
  if (cachedAuth !== undefined) return cachedAuth
  cachedAuth = null
  try {
    if (existsSync(authFilePath())) {
      const data = readFileSync(authFilePath())
      const raw = safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(data)
        : data.toString('utf8')
      cachedAuth = JSON.parse(raw) as StoredAuth
    }
  } catch {
    cachedAuth = null
  }
  return cachedAuth
}

// --- PKCE-Hilfen -------------------------------------------------------------

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function makeVerifier(): string {
  return base64url(randomBytes(48))
}
function challengeFor(verifier: string): string {
  return base64url(createHash('sha256').update(verifier).digest())
}

/** Wartet (einmalig) auf die Spotify-Weiterleitung mit dem Autorisierungs-Code. */
function waitForCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '', REDIRECT_URI)
      if (url.pathname !== '/callback') {
        res.statusCode = 404
        res.end()
        return
      }
      const code = url.searchParams.get('code')
      const err = url.searchParams.get('error')
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(
        '<html><body style="font-family:sans-serif;background:#0f1117;color:#e6e8ee;text-align:center;padding-top:60px">' +
          (code
            ? '<h2>✓ buffd ist jetzt mit Spotify verbunden</h2><p>Du kannst dieses Fenster schließen und zu buffd zurückkehren.</p>'
            : '<h2>Anmeldung abgebrochen</h2>') +
          '</body></html>'
      )
      clearTimeout(timer)
      server.close()
      if (code) resolve(code)
      else reject(new Error(err || 'Kein Code von Spotify erhalten.'))
    })
    server.on('error', (e) => reject(e))
    server.listen(REDIRECT_PORT, '127.0.0.1')
    const timer = setTimeout(() => {
      server.close()
      reject(new Error('Zeitüberschreitung bei der Spotify-Anmeldung.'))
    }, 120000)
  })
}

interface TokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
  error_description?: string
}

async function requestToken(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString()
  })
  const json = (await res.json()) as TokenResponse
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description ?? `Spotify-Token-Fehler (HTTP ${res.status})`)
  }
  return json
}

async function getAccessToken(): Promise<string> {
  const auth = loadAuth()
  const id = clientId()
  if (!auth || !id) throw new Error('Kein Spotify-Konto verbunden.')
  if (accessToken && Date.now() / 1000 < accessTokenExpiresAt) return accessToken
  const t = await requestToken({
    grant_type: 'refresh_token',
    refresh_token: auth.refreshToken,
    client_id: id
  })
  accessToken = t.access_token
  accessTokenExpiresAt = Math.floor(Date.now() / 1000) + t.expires_in - 60
  // Spotify rotiert das Refresh-Token nur manchmal -> altes behalten, wenn keins kommt.
  if (t.refresh_token) saveAuth({ ...auth, refreshToken: t.refresh_token })
  return accessToken
}

// --- Öffentliche API (IPC) ---------------------------------------------------

export function spotifyStatus(): SpotifyStatus {
  const auth = loadAuth()
  return {
    connected: auth !== null,
    displayName: auth?.displayName ?? null,
    configured: clientId() !== null
  }
}

/** Eigene Spotify-Client-ID hinterlegen/entfernen (persönliche Einrichtung). */
export function setSpotifyClientId(id: string | null): SpotifyStatus {
  const cleaned = id?.trim()
  setStoredKey('spotifyClientId', cleaned ? cleaned : null)
  if (!cleaned) spotifyLogout() // ohne ID ergibt eine bestehende Verbindung keinen Sinn
  return spotifyStatus()
}

/** Startet den Spotify-Login (öffnet den Browser) und schließt ihn ab. */
export async function spotifyLogin(): Promise<{ ok: true; status: SpotifyStatus } | { ok: false; error: string }> {
  const id = clientId()
  if (!id) {
    return { ok: false, error: 'Keine Spotify-Client-ID hinterlegt — die App ist noch nicht eingerichtet.' }
  }
  try {
    const verifier = makeVerifier()
    const authUrl =
      `${AUTH_URL}?response_type=code&client_id=${encodeURIComponent(id)}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&scope=${encodeURIComponent(SCOPES)}` +
      `&code_challenge_method=S256&code_challenge=${challengeFor(verifier)}`

    const codePromise = waitForCode() // Server VOR dem Öffnen starten
    await shell.openExternal(authUrl)
    const code = await codePromise

    const t = await requestToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: id,
      code_verifier: verifier
    })
    accessToken = t.access_token
    accessTokenExpiresAt = Math.floor(Date.now() / 1000) + t.expires_in - 60

    // Anzeigenamen holen.
    let displayName = 'Spotify'
    try {
      const me = await fetch(`${API}/me`, { headers: { Authorization: `Bearer ${t.access_token}` } })
      if (me.ok) displayName = ((await me.json()) as { display_name?: string }).display_name || 'Spotify'
    } catch {
      /* Name ist nur Kosmetik */
    }
    saveAuth({ refreshToken: t.refresh_token ?? '', displayName })
    return { ok: true, status: spotifyStatus() }
  } catch (err) {
    return { ok: false, error: String(err instanceof Error ? err.message : err) }
  }
}

export function spotifyLogout(): SpotifyStatus {
  accessToken = null
  cachedAuth = null
  try {
    rmSync(authFilePath(), { force: true })
  } catch {
    /* ignorieren */
  }
  return spotifyStatus()
}

interface PlayerResponse {
  is_playing: boolean
  item?: {
    name: string
    artists?: { name: string }[]
    album?: { images?: { url: string }[] }
    external_urls?: { spotify?: string }
  } | null
}

/** Aktuellen Wiedergabe-Zustand abrufen. */
export async function spotifyGetState(): Promise<SpotifyState> {
  const base: SpotifyState = {
    ok: true,
    connected: loadAuth() !== null,
    active: false,
    isPlaying: false,
    track: null,
    artists: null,
    albumArt: null,
    trackUrl: null
  }
  if (!base.connected) return base
  try {
    const token = await getAccessToken()
    const res = await fetch(`${API}/me/player`, { headers: { Authorization: `Bearer ${token}` } })
    if (res.status === 204) return base // kein aktives Gerät / nichts läuft
    if (!res.ok) return { ...base, ok: false, error: `Spotify antwortet nicht (HTTP ${res.status}).` }
    const json = (await res.json()) as PlayerResponse
    const item = json.item
    if (!item) return base
    return {
      ...base,
      active: true,
      isPlaying: json.is_playing,
      track: item.name,
      artists: (item.artists ?? []).map((a) => a.name).join(', ') || null,
      albumArt: item.album?.images?.[0]?.url ?? null,
      trackUrl: item.external_urls?.spotify ?? null
    }
  } catch (err) {
    return { ...base, ok: false, error: String(err instanceof Error ? err.message : err) }
  }
}

export type SpotifyAction = 'play' | 'pause' | 'next' | 'previous'

/** Wiedergabe steuern (Premium + aktives Gerät nötig). */
export async function spotifyControl(action: SpotifyAction): Promise<{ ok: boolean; needsPremium?: boolean; error?: string }> {
  try {
    const token = await getAccessToken()
    const method = action === 'next' || action === 'previous' ? 'POST' : 'PUT'
    const res = await fetch(`${API}/me/player/${action}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Length': '0' }
    })
    if (res.status === 403) return { ok: false, needsPremium: true, error: 'Steuern erfordert Spotify Premium.' }
    if (res.status === 404) return { ok: false, error: 'Kein aktives Spotify-Gerät — starte Spotify einmal kurz.' }
    if (!res.ok && res.status !== 204) return { ok: false, error: `Spotify-Fehler (HTTP ${res.status}).` }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err instanceof Error ? err.message : err) }
  }
}

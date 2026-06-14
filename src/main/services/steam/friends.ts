// Stufe A des Freunde-Systems: Steam-Freunde NUR LESEN über die offizielle
// Web-API — kein eigener Server, keine eigenen Konten.
//   - GetFriendList        -> die SteamID64 aller Freunde
//   - GetPlayerSummaries   -> Name, Avatar, Online-Status, aktuelles Spiel
//   - GetOwnedGames        -> die Bibliothek eines einzelnen Freundes
// Voraussetzung: hinterlegter Web-API-Key. Sichtbar ist nur, was der jeweilige
// Freund über SEINE Steam-Privatsphäre öffentlich gestellt hat.

import type {
  FriendGame,
  FriendGamesResult,
  FriendOnGame,
  FriendsForGameResult,
  FriendState,
  SteamFriend,
  SteamFriendsResult
} from '@shared/types'
import { getSteamApiKey, steamIdentity } from './webapi'

const API = 'https://api.steampowered.com'

// Steam liefert personastate als Zahl; nur aussagekräftig bei öffentlichem Profil.
function mapState(personastate: number | undefined, inGame: boolean): FriendState {
  if (inGame) return 'ingame'
  switch (personastate) {
    case 1:
      return 'online'
    case 2:
      return 'busy'
    case 3:
    case 4: // 4 = Snooze -> wie "abwesend" behandeln
      return 'away'
    default:
      return 'offline' // 0 oder unbekannt
  }
}

interface PlayerSummary {
  steamid: string
  personaname?: string
  profileurl?: string
  avatarfull?: string
  avatarmedium?: string
  personastate?: number
  communityvisibilitystate?: number // 3 = öffentlich, sonst privat/eingeschränkt
  gameextrainfo?: string // Name des gerade gespielten Spiels
  gameid?: string // AppID des gerade gespielten Spiels
  lastlogoff?: number
}

/** Spieler-Zusammenfassungen in Blöcken zu max. 100 IDs abrufen. */
async function fetchSummaries(key: string, steamIds: string[]): Promise<Map<string, PlayerSummary>> {
  const out = new Map<string, PlayerSummary>()
  for (let i = 0; i < steamIds.length; i += 100) {
    const block = steamIds.slice(i, i + 100)
    const res = await fetch(
      `${API}/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${block.join(',')}`,
      { signal: AbortSignal.timeout(15000) }
    )
    if (!res.ok) continue
    const json = (await res.json()) as { response?: { players?: PlayerSummary[] } }
    for (const p of json.response?.players ?? []) out.set(p.steamid, p)
  }
  return out
}

/**
 * Die eigene Steam-Freundesliste samt Online-Status. Gibt aussagekräftige
 * Zustände zurück (kein Key / Liste privat), damit die UI das erklären kann.
 */
export async function getSteamFriends(): Promise<SteamFriendsResult> {
  const key = getSteamApiKey()
  const identity = steamIdentity()
  if (!key || !identity) {
    return { ok: false, friends: [], keyMissing: true, listPrivate: false }
  }

  try {
    // 1) IDs der Freunde holen.
    const listRes = await fetch(
      `${API}/ISteamUser/GetFriendList/v1/?key=${key}&steamid=${identity.steamId}&relationship=friend`,
      { signal: AbortSignal.timeout(15000) }
    )
    // 401/403 -> eigene Freundesliste ist nicht öffentlich.
    if (listRes.status === 401 || listRes.status === 403) {
      return { ok: false, friends: [], keyMissing: false, listPrivate: true }
    }
    if (!listRes.ok) {
      return { ok: false, friends: [], keyMissing: false, listPrivate: false, error: `Steam antwortet nicht (HTTP ${listRes.status}).` }
    }
    const listJson = (await listRes.json()) as {
      friendslist?: { friends?: { steamid: string }[] }
    }
    const ids = (listJson.friendslist?.friends ?? []).map((f) => f.steamid)
    if (ids.length === 0) {
      // Kein friendslist-Feld = privat; leere Liste = wirklich keine Freunde.
      if (!listJson.friendslist) return { ok: false, friends: [], keyMissing: false, listPrivate: true }
      return { ok: true, friends: [], keyMissing: false, listPrivate: false }
    }

    // 2) Status/Namen/Avatare dazuladen.
    const summaries = await fetchSummaries(key, ids)
    const friends: SteamFriend[] = ids.map((id) => {
      const p = summaries.get(id)
      const isPublic = (p?.communityvisibilitystate ?? 1) === 3
      const gameId = p?.gameid ? Number(p.gameid) : null
      const inGame = isPublic && !!gameId
      return {
        steamId: id,
        personaName: p?.personaname ?? 'Steam-Freund',
        avatarUrl: p?.avatarfull ?? p?.avatarmedium ?? null,
        state: mapState(isPublic ? p?.personastate : 0, inGame),
        currentGame: inGame ? p?.gameextrainfo ?? null : null,
        currentGameAppId: inGame ? gameId : null,
        profileUrl: p?.profileurl ?? null,
        lastLogoff: isPublic && p?.lastlogoff ? p.lastlogoff : null,
        private: !isPublic
      }
    })

    // Sortierung: erst wer spielt, dann online, abwesend/beschäftigt, zuletzt
    // offline — innerhalb jeder Gruppe alphabetisch.
    const rank: Record<FriendState, number> = { ingame: 0, online: 1, away: 2, busy: 2, offline: 3 }
    friends.sort((a, b) => {
      if (rank[a.state] !== rank[b.state]) return rank[a.state] - rank[b.state]
      return a.personaName.localeCompare(b.personaName, 'de')
    })

    return { ok: true, friends, keyMissing: false, listPrivate: false }
  } catch {
    return {
      ok: false,
      friends: [],
      keyMissing: false,
      listPrivate: false,
      error: 'Keine Verbindung zu Steam möglich — bist du online?'
    }
  }
}

interface OwnedGamesResponse {
  response?: {
    games?: {
      appid: number
      name?: string
      playtime_forever?: number // Minuten
      rtime_last_played?: number // Unix-Sek.
    }[]
  }
}

// Roh-Bibliothek eines Freundes: appId -> Spielzeit (Sek.). Pro Sitzung kurz
// zwischengespeichert, damit nicht jede Spiel-Detailseite alle Freunde neu
// abfragt. null = privat/Fehler (wird ebenfalls gecacht, um Steam zu schonen).
const libCache = new Map<string, { at: number; games: Map<number, number> | null }>()
const LIB_TTL = 10 * 60 * 1000 // 10 Minuten

async function fetchFriendLibrary(
  key: string,
  steamId: string
): Promise<Map<number, number> | null> {
  const cached = libCache.get(steamId)
  if (cached && Date.now() - cached.at < LIB_TTL) return cached.games

  let result: Map<number, number> | null = null
  try {
    const res = await fetch(
      `${API}/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${steamId}&format=json`,
      { signal: AbortSignal.timeout(15000) }
    )
    if (res.ok) {
      const json = (await res.json()) as OwnedGamesResponse
      if (json.response?.games) {
        result = new Map(json.response.games.map((g) => [g.appid, (g.playtime_forever ?? 0) * 60]))
      }
    }
  } catch {
    /* offline/Fehler -> null (privat oder nicht erreichbar) */
  }
  libCache.set(steamId, { at: Date.now(), games: result })
  return result
}

/**
 * Die Bibliothek eines Freundes (nur lesbar, wenn dessen Spieldetails öffentlich
 * sind). private=true signalisiert der UI „dieser Freund teilt seine Spiele nicht".
 */
export async function getFriendGames(steamId: string): Promise<FriendGamesResult> {
  const key = getSteamApiKey()
  if (!key) return { ok: false, games: [], private: false, error: 'Kein Steam-Web-API-Key hinterlegt.' }
  if (!/^\d{17}$/.test(steamId)) return { ok: false, games: [], private: false, error: 'Ungültige SteamID.' }

  try {
    const res = await fetch(
      `${API}/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${steamId}` +
        `&include_appinfo=1&include_played_free_games=1&format=json`,
      { signal: AbortSignal.timeout(15000) }
    )
    if (!res.ok) return { ok: false, games: [], private: false, error: `Steam antwortet nicht (HTTP ${res.status}).` }
    const json = (await res.json()) as OwnedGamesResponse
    // Fehlendes games-Feld = Spieldetails privat.
    if (!json.response?.games) return { ok: true, games: [], private: true }

    const games: FriendGame[] = json.response.games
      .filter((g) => g.name)
      .map((g) => ({
        appId: g.appid,
        name: g.name as string,
        playtimeSec: (g.playtime_forever ?? 0) * 60,
        lastPlayed: g.rtime_last_played ? g.rtime_last_played : null,
        coverUrl: `https://steamcdn-a.akamaihd.net/steam/apps/${g.appid}/library_600x900.jpg`
      }))
    // Meistgespielte zuerst.
    games.sort((a, b) => b.playtimeSec - a.playtimeSec)
    return { ok: true, games, private: false }
  } catch {
    return { ok: false, games: [], private: false, error: 'Keine Verbindung zu Steam möglich.' }
  }
}

/**
 * Welche Steam-Freunde ein bestimmtes Spiel besitzen — samt ihrer Spielzeit.
 * Für die Spiel-Detailseite. Fragt (gecacht) die Bibliothek jedes Freundes ab;
 * Freunde mit privaten Spieldetails tauchen nicht auf.
 */
export async function getFriendsForGame(appId: number): Promise<FriendsForGameResult> {
  const key = getSteamApiKey()
  if (!key) return { ok: false, friends: [], keyMissing: true }
  if (!Number.isFinite(appId) || appId <= 0) return { ok: true, friends: [], keyMissing: false }

  // Freundesliste + Namen/Avatare wiederverwenden.
  const list = await getSteamFriends()
  if (!list.ok) return { ok: false, friends: [], keyMissing: list.keyMissing }

  // Bibliotheken aller Freunde (parallel, gecacht) und nach dem Spiel filtern.
  const results = await Promise.all(
    list.friends.map(async (f) => {
      const lib = await fetchFriendLibrary(key, f.steamId)
      if (!lib || !lib.has(appId)) return null
      return {
        steamId: f.steamId,
        personaName: f.personaName,
        avatarUrl: f.avatarUrl,
        playtimeSec: lib.get(appId) ?? 0
      } as FriendOnGame
    })
  )

  const friends = results.filter((f): f is FriendOnGame => f !== null)
  friends.sort((a, b) => b.playtimeSec - a.playtimeSec)
  return { ok: true, friends, keyMissing: false }
}

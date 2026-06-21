// SteamGridDB-Anbindung: hochwertige Hochformat-Cover (600x900) für Spiele
// ALLER Plattformen — deutlich schöner als die Wikipedia-Logos. Braucht einen
// kostenlosen API-Key (steamgriddb.com -> Profil -> Preferences -> API).

import type { SgdbStatus } from '@shared/types'
import {
  listGamesWithWikiCover,
  setGameCover,
  getGameHero,
  setGameHero
} from '../db'
import { getStoredKey, setStoredKey } from './keys'
import { BUILTIN_SGDB_KEY } from './builtinKeys'

const API = 'https://www.steamgriddb.com/api/v2'

/** Eigener (hinterlegter) Key hat Vorrang, sonst der eingebaute Standard-Key. */
function getSgdbKey(): string | null {
  return getStoredKey('sgdbApiKey') ?? BUILTIN_SGDB_KEY
}

export function sgdbStatus(): SgdbStatus {
  const own = getStoredKey('sgdbApiKey') !== null
  return { connected: own || BUILTIN_SGDB_KEY !== null, builtin: !own && BUILTIN_SGDB_KEY !== null }
}

async function sgdbFetch(key: string, path: string): Promise<unknown> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10000)
  })
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) return null
  return res.json()
}

/** Hochformat-Cover (600x900) zu einem Spielnamen suchen. */
export async function sgdbCover(name: string): Promise<string | null> {
  const key = getSgdbKey()
  if (!key) return null
  try {
    const search = (await sgdbFetch(
      key,
      `/search/autocomplete/${encodeURIComponent(name)}`
    )) as { data?: { id: number }[] } | null
    const gameId = search?.data?.[0]?.id
    if (!gameId) return null

    const grids = (await sgdbFetch(
      key,
      `/grids/game/${gameId}?dimensions=600x900&types=static`
    )) as { data?: { url: string }[] } | null
    return grids?.data?.[0]?.url ?? null
  } catch {
    return null
  }
}

// Nur statische, jugendfreie Banner (kein NSFW, kein „Humor"/Meme).
const HERO_QUERY = 'types=static&nsfw=false&humor=false'

/**
 * Aus einer SGDB-Heroes-Antwort die besten 3 URLs ziehen. Breitbild (≥ 1920 px)
 * wird bevorzugt; innerhalb gleicher Klasse bleibt die SGDB-Reihenfolge (nach
 * Beliebtheit) erhalten.
 */
function pickHeroes(json: unknown): string[] {
  const items =
    (json as { data?: { url: string; width?: number; height?: number }[] } | null)?.data ?? []
  return items
    .map((h, i) => ({ h, i }))
    .sort(
      (a, b) =>
        ((b.h.width ?? 0) >= 1920 ? 1 : 0) - ((a.h.width ?? 0) >= 1920 ? 1 : 0) || a.i - b.i
    )
    .slice(0, 3)
    .map((x) => x.h.url)
}

/**
 * Querformat-„Hero"-Banner zu einem Spiel suchen (bis zu 3). Steam-Spiele lassen
 * sich direkt über die AppID abfragen; für alle anderen über die Namenssuche.
 */
async function sgdbHeroes(platform: string, platformId: string, name: string): Promise<string[]> {
  const key = getSgdbKey()
  if (!key) return []
  try {
    // Steam: direkter Weg über die AppID (am genauesten).
    if (platform === 'steam' && platformId) {
      const direct = await sgdbFetch(key, `/heroes/steam/${platformId}?${HERO_QUERY}`)
      const urls = pickHeroes(direct)
      if (urls.length > 0) return urls
    }
    // Sonst (oder falls Steam nichts hatte): über die Namenssuche das Spiel finden.
    const search = (await sgdbFetch(
      key,
      `/search/autocomplete/${encodeURIComponent(name)}`
    )) as { data?: { id: number }[] } | null
    const gameId = search?.data?.[0]?.id
    if (!gameId) return []
    return pickHeroes(await sgdbFetch(key, `/heroes/game/${gameId}?${HERO_QUERY}`))
  } catch {
    return []
  }
}

/** Cache-Wert der DB in eine URL-Liste übersetzen (robust gegen alten Einzel-URL-Cache). */
function parseHeroCache(raw: string): string[] {
  if (!raw) return []
  if (raw[0] === '[') {
    try {
      return JSON.parse(raw) as string[]
    } catch {
      return []
    }
  }
  return [raw] // Alt-Cache: einzelne URL
}

/**
 * Cache-bewusster Hero-Abruf: liefert die zwischengespeicherten URLs, sonst fragt
 * er SGDB einmal an und merkt sich das Ergebnis (auch „nichts gefunden") in der DB.
 * Rückgabe: bis zu 3 URLs.
 */
export async function gameHero(
  platform: string,
  platformId: string,
  name: string
): Promise<string[]> {
  const cached = getGameHero(platform, platformId)
  // null = noch nie geprüft -> jetzt abrufen. '' = geprüft, keiner. sonst JSON-Liste.
  if (cached !== null && cached !== undefined) return parseHeroCache(cached)
  const urls = await sgdbHeroes(platform, platformId, name)
  setGameHero(platform, platformId, urls.length > 0 ? JSON.stringify(urls) : '')
  return urls
}

/**
 * Bestehende Wikipedia-Logo-Cover durch echte Box-Art ersetzen — läuft einmal,
 * wenn der Key hinterlegt wird. Gibt die Anzahl der verbesserten Cover zurück.
 */
export async function upgradeWikiCovers(platforms: string[]): Promise<number> {
  let upgraded = 0
  for (const game of listGamesWithWikiCover(platforms)) {
    const url = await sgdbCover(game.name)
    if (url) {
      setGameCover(game.platform, game.platformId, url)
      upgraded++
    }
  }
  return upgraded
}

/** Key prüfen (Probe-Anfrage) und bei Erfolg verschlüsselt speichern. */
export async function setSgdbKey(
  key: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cleaned = key.trim()
  if (cleaned.length < 16) {
    return { ok: false, error: 'Der Key sieht zu kurz aus — bitte den kompletten Wert einfügen.' }
  }
  try {
    const res = await fetch(`${API}/search/autocomplete/portal`, {
      headers: { Authorization: `Bearer ${cleaned}` },
      signal: AbortSignal.timeout(10000)
    })
    if (res.status === 401) return { ok: false, error: 'SteamGridDB hat den Key abgelehnt — bitte prüfen.' }
    if (!res.ok) return { ok: false, error: `SteamGridDB antwortet nicht (HTTP ${res.status}).` }
  } catch {
    return { ok: false, error: 'Keine Verbindung zu SteamGridDB möglich — bist du online?' }
  }
  setStoredKey('sgdbApiKey', cleaned)
  return { ok: true }
}

export function clearSgdbKey(): SgdbStatus {
  setStoredKey('sgdbApiKey', null)
  return sgdbStatus()
}

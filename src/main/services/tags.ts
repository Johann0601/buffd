// Steam-Community-Tags pro Spiel — für den Tag-Filter auf der Spiele-Seite.
// Die offizielle Store-API liefert diese Tags NICHT; SteamSpy aggregiert sie
// aber und gibt sie als JSON heraus:
//   https://steamspy.com/api.php?request=appdetails&appid=<appid>
//     -> { tags: { "Action": 5000, "FPS": 4200, ... } }  (oder [] = keine)
// SteamSpy bittet um höfliche Drosselung -> ~1 Anfrage/Sekunde.

import { listGamesNeedingTags, setGameTags } from '../db'
import { steamSearchAppId } from './steam/storesearch'

const TOP_N = 8 // so viele (beliebteste) Tags pro Spiel speichern
const THROTTLE_MS = 1200

let running = false // verhindert parallele Durchläufe (z. B. mehrfacher UI-Aufruf)

/** AppID bestimmen: Steam-Spiele direkt, sonst per Namenssuche (gecacht). */
async function resolveAppId(platform: string, platformId: string, name: string): Promise<number | null> {
  if (platform === 'steam') {
    const id = Number(platformId)
    return Number.isFinite(id) ? id : null
  }
  return steamSearchAppId(name)
}

/** Top-Tags eines Spiels von SteamSpy holen. null = Fehler (später erneut versuchen). */
async function fetchSteamSpyTags(appId: number): Promise<string[] | null> {
  try {
    const res = await fetch(`https://steamspy.com/api.php?request=appdetails&appid=${appId}`, {
      signal: AbortSignal.timeout(12000)
    })
    if (!res.ok) return null
    const json = (await res.json()) as { tags?: Record<string, number> | unknown[] }
    const tags = json.tags
    if (!tags || Array.isArray(tags)) return [] // [] = SteamSpy kennt keine Tags
    return Object.entries(tags as Record<string, number>)
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_N)
      .map(([t]) => t)
  } catch {
    return null
  }
}

/**
 * Holt für alle installierten Spiele ohne Tags die Steam-Community-Tags nach
 * (gedrosselt). Gibt zurück, wie viele Spiele neue Tags bekommen haben.
 */
export async function ensureGameTags(): Promise<number> {
  if (running) return 0
  running = true
  let updated = 0
  try {
    for (const g of listGamesNeedingTags()) {
      const appId = await resolveAppId(g.platform, g.platformId, g.name)
      const tags = appId !== null ? await fetchSteamSpyTags(appId) : null

      if (tags !== null) {
        // Erfolgreich (auch leere Liste) -> als geprüft markieren.
        setGameTags(g.platform, g.platformId, tags.join(','))
        if (tags.length > 0) updated++
      } else if (appId === null) {
        // Kein Steam-Treffer -> dauerhaft leer, nicht endlos neu versuchen.
        setGameTags(g.platform, g.platformId, '')
      }
      // Netzfehler (tags === null trotz appId) -> NICHT markieren: nächster Lauf erneut.

      await new Promise((r) => setTimeout(r, THROTTLE_MS))
    }
  } finally {
    running = false
  }
  return updated
}

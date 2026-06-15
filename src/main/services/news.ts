// Gebündelter News-/Patchnotes-Feed über die ganze Bibliothek (A7).
// Statt News nur einzeln auf der Detailseite zu zeigen, sammeln wir hier die
// neuesten Meldungen aller installierten Steam-Spiele in einem Feed.
//
// Quelle: Steam News API (ISteamNews/GetNewsForApp) — kein Key nötig.
// v1 beschränkt sich auf Steam-Spiele (AppID = platformId, kein teures
// Namens-Auflösen pro Spiel). Ergebnis wird kurz zwischengespeichert.

import type { LibraryNewsItem, LibraryNewsResult } from '@shared/types'
import { listGames } from '../db'
import { cleanNewsText } from './gamedetails'

const TTL_MS = 20 * 60 * 1000 // 20 Minuten Cache
const PER_GAME = 3 // höchstens so viele News pro Spiel in den Feed
const MAX_ITEMS = 60 // Gesamtlänge des Feeds
const MAX_AGE_SEC = 180 * 24 * 3600 // nichts älter als ~6 Monate

interface NewsItemRaw {
  title: string
  url: string
  date: number
  feedlabel: string
  contents: string
}

let cache: { at: number; result: LibraryNewsResult } | null = null

async function fetchAppNews(appId: number): Promise<NewsItemRaw[]> {
  try {
    const res = await fetch(
      `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${appId}&count=5&maxlength=800`,
      { signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) return []
    const json = (await res.json()) as { appnews?: { newsitems?: NewsItemRaw[] } }
    return json.appnews?.newsitems ?? []
  } catch {
    return []
  }
}

/**
 * Neueste News aller installierten Steam-Spiele, zu einem Feed zusammengeführt
 * und nach Datum sortiert. `force` umgeht den Cache (Knopf „Aktualisieren").
 */
export async function getLibraryNews(force = false): Promise<LibraryNewsResult> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.result

  const steamGames = listGames().filter((g) => g.kind === 'game' && g.platform === 'steam')
  const cutoff = Math.floor(Date.now() / 1000) - MAX_AGE_SEC

  const perGame = await Promise.all(
    steamGames.map(async (g) => {
      const appId = Number(g.platformId)
      if (!Number.isFinite(appId)) return [] as LibraryNewsItem[]
      const raw = await fetchAppNews(appId)
      return raw
        .filter((n) => n.title && n.url && n.date >= cutoff)
        .slice(0, PER_GAME)
        .map<LibraryNewsItem>((n) => ({
          gameName: g.name,
          appId,
          coverUrl: g.coverUrl,
          title: n.title,
          url: n.url,
          date: n.date,
          feedLabel: n.feedlabel || 'Steam',
          excerpt: cleanNewsText(n.contents || '')
        }))
    })
  )

  const items = perGame
    .flat()
    .sort((a, b) => b.date - a.date)
    .slice(0, MAX_ITEMS)

  const result: LibraryNewsResult = { ok: true, items, scannedGames: steamGames.length }
  cache = { at: Date.now(), result }
  return result
}

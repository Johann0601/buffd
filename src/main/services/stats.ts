// Statistik / Dashboard (A1): wertet vorhandene Daten aus — die getrackten
// Spiel-Sitzungen (mit Zeitstempeln) und die Spielzeiten pro Spiel. Es werden
// KEINE neuen Daten erhoben, nur zusammengefasst.

import type { PlaytimePeriods, PlayStatsResult, StatTopGame } from '@shared/types'
import { getSessionStats, listGames, sumPlaytimeSince, type PlayStatsBoundaries } from '../db'

const DAY = 86400
const HEATMAP_DAYS = 112 // 16 Wochen (7×16-Raster für die Heatmap)

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Getrackte Spielzeit über 14/30/365 Tage — fürs Dashboard-Widget. */
export function getPlaytimePeriods(): PlaytimePeriods {
  const now = Math.floor(Date.now() / 1000)
  return {
    d14: sumPlaytimeSince(now - 14 * DAY),
    d30: sumPlaytimeSince(now - 30 * DAY),
    d365: sumPlaytimeSince(now - 365 * DAY)
  }
}

export function getPlayStats(): PlayStatsResult {
  const now = Math.floor(Date.now() / 1000)

  // Lokale Mitternacht heute.
  const midnight = new Date()
  midnight.setHours(0, 0, 0, 0)
  const today = Math.floor(midnight.getTime() / 1000)

  const boundaries: PlayStatsBoundaries = {
    today,
    week: now - 7 * DAY,
    month: now - 30 * DAY,
    dailySince: today - (HEATMAP_DAYS - 1) * DAY
  }

  const s = getSessionStats(boundaries)

  // Spiele (ohne Launcher) für Gesamtzahlen und „meistgespielt".
  const games = listGames().filter((g) => g.kind === 'game')
  const played = games.filter((g) => g.totalPlaytimeSec > 0)
  const totalPlaytimeSec = games.reduce((a, g) => a + g.totalPlaytimeSec, 0)
  const topGames: StatTopGame[] = played.slice(0, 8).map((g) => ({
    name: g.name,
    platform: g.platform,
    coverUrl: g.coverUrl,
    playtimeSec: g.totalPlaytimeSec
  }))

  // Tagesraster lückenlos auffüllen (auch Tage ohne Sitzung → 0), damit die
  // Heatmap ein vollständiges 7×N-Gitter zeichnen kann.
  const dailyMap = new Map(s.daily.map((x) => [x.day, x.sec]))
  const daily: { day: string; sec: number }[] = []
  const cursor = new Date(boundaries.dailySince * 1000)
  for (let i = 0; i < HEATMAP_DAYS; i++) {
    const key = dayKey(cursor)
    daily.push({ day: key, sec: dailyMap.get(key) ?? 0 })
    cursor.setDate(cursor.getDate() + 1) // DST-sicher Tag für Tag weiterzählen
  }

  // Wochentage von Steam-Zählung (0=So..6=Sa) auf Mo..So umlegen.
  const weekday = [0, 0, 0, 0, 0, 0, 0]
  for (const w of s.weekday) weekday[(w.wd + 6) % 7] = w.sec

  return {
    totalPlaytimeSec,
    trackedPlaytimeSec: s.trackedTotalSec,
    trackingSince: s.earliest,
    sessionsCount: s.sessionsCount,
    gamesTotal: games.length,
    gamesPlayed: played.length,
    gamesNeverPlayed: games.length - played.length,
    todaySec: s.todaySec,
    weekSec: s.weekSec,
    monthSec: s.monthSec,
    topGames,
    daily,
    weekday
  }
}

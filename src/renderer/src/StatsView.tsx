import { useEffect, useState } from 'react'
import type { PlayStatsResult } from '@shared/types'
import { formatPlaytime } from './format'

// Statistik / Dashboard (A1): wertet die getrackten Spiel-Sitzungen aus.
// Aktivitäts-Heatmap, Eckdaten, meistgespielte Spiele und Wochentags-Verteilung.

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

function heatLevel(sec: number, max: number): number {
  if (sec <= 0 || max <= 0) return 0
  const r = sec / max
  if (r > 0.66) return 4
  if (r > 0.33) return 3
  if (r > 0.1) return 2
  return 1
}

function dayTooltip(day: string, sec: number): string {
  const d = new Date(`${day}T00:00:00`)
  const label = d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' })
  return sec > 0 ? `${label}: ${formatPlaytime(sec)}` : `${label}: nichts gespielt`
}

function StatsView(): JSX.Element {
  const [stats, setStats] = useState<PlayStatsResult | null>(null)
  const [loading, setLoading] = useState(true)

  const load = (): void => {
    setLoading(true)
    window.api
      .getPlayStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const maxDaily = stats ? Math.max(1, ...stats.daily.map((d) => d.sec)) : 1
  const maxWeekday = stats ? Math.max(1, ...stats.weekday) : 1
  const maxTop = stats && stats.topGames.length > 0 ? stats.topGames[0].playtimeSec : 1

  // Heatmap: Leerzellen vor dem ersten Tag, damit Wochentage in den Zeilen stimmen.
  const firstOffset = stats && stats.daily.length > 0
    ? (new Date(`${stats.daily[0].day}T00:00:00`).getDay() + 6) % 7 // Mo=0..So=6
    : 0

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>📊 Statistik</h1>
          <span className="subtitle">{loading ? 'lädt …' : 'deine Spielzeit auf einen Blick'}</span>
        </div>
        <button className="btn" onClick={load} disabled={loading}>
          {loading ? 'Lädt …' : '↻ Aktualisieren'}
        </button>
      </header>

      <main className="content">
        {stats && (
          <>
            {/* Eckdaten */}
            <div className="stat-cards">
              <div className="stat-card static">
                <span className="stat-card-icon">⏱️</span>
                <span className="stat-card-title">Gesamte Spielzeit</span>
                <span className="stat-card-info">{formatPlaytime(stats.totalPlaytimeSec)}</span>
              </div>
              <div className="stat-card static">
                <span className="stat-card-icon">📅</span>
                <span className="stat-card-title">Letzte 7 Tage</span>
                <span className="stat-card-info">{formatPlaytime(stats.weekSec)}</span>
              </div>
              <div className="stat-card static">
                <span className="stat-card-icon">🗓️</span>
                <span className="stat-card-title">Letzte 30 Tage</span>
                <span className="stat-card-info">{formatPlaytime(stats.monthSec)}</span>
              </div>
              <div className="stat-card static">
                <span className="stat-card-icon">🎮</span>
                <span className="stat-card-title">Spiele</span>
                <span className="stat-card-info">
                  {stats.gamesPlayed} gespielt · {stats.gamesNeverPlayed} ungespielt
                </span>
              </div>
            </div>

            {/* Aktivitäts-Heatmap */}
            <h2 className="section-title">Aktivität (letzte 16 Wochen)</h2>
            {stats.trackedPlaytimeSec === 0 ? (
              <p className="hint">
                Hier entsteht deine Spiel-Heatmap, sobald buffd Sitzungen aufzeichnet — starte
                einfach ein paar Spiele über die App (oder bei laufender App), dann füllt sie sich.
              </p>
            ) : (
              <div className="heatmap-wrap">
                <div className="heatmap-days">
                  {WEEKDAYS.map((w, i) => (
                    <span key={w} className="heatmap-day-label">
                      {i % 2 === 0 ? w : ''}
                    </span>
                  ))}
                </div>
                <div className="heatmap-grid">
                  {Array.from({ length: firstOffset }).map((_, i) => (
                    <span key={`pad-${i}`} className="heatmap-cell empty" />
                  ))}
                  {stats.daily.map((d) => (
                    <span
                      key={d.day}
                      className={`heatmap-cell lvl-${heatLevel(d.sec, maxDaily)}`}
                      title={dayTooltip(d.day, d.sec)}
                    />
                  ))}
                </div>
                <div className="heatmap-legend">
                  <span>weniger</span>
                  <span className="heatmap-cell lvl-0" />
                  <span className="heatmap-cell lvl-1" />
                  <span className="heatmap-cell lvl-2" />
                  <span className="heatmap-cell lvl-3" />
                  <span className="heatmap-cell lvl-4" />
                  <span>mehr</span>
                </div>
              </div>
            )}

            {/* Meistgespielt */}
            {stats.topGames.length > 0 && (
              <>
                <h2 className="section-title" style={{ marginTop: 26 }}>
                  Meistgespielt
                </h2>
                <div className="top-games">
                  {stats.topGames.map((g) => (
                    <div key={g.platform + g.name} className="top-game" title={g.name}>
                      <div className="top-game-cover">
                        {g.coverUrl ? (
                          <img src={g.coverUrl} alt="" loading="lazy" />
                        ) : (
                          <span className="top-game-noart">{g.name.charAt(0)}</span>
                        )}
                      </div>
                      <div className="top-game-main">
                        <div className="top-game-name">{g.name}</div>
                        <div className="top-game-bar">
                          <div
                            className="top-game-fill"
                            style={{ width: `${Math.max(3, (g.playtimeSec / maxTop) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="top-game-time">{formatPlaytime(g.playtimeSec)}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Wochentage */}
            {stats.trackedPlaytimeSec > 0 && (
              <>
                <h2 className="section-title" style={{ marginTop: 26 }}>
                  Wann du spielst
                </h2>
                <div className="weekday-chart">
                  {stats.weekday.map((sec, i) => (
                    <div key={WEEKDAYS[i]} className="weekday-col" title={formatPlaytime(sec)}>
                      <div className="weekday-bar-wrap">
                        <div
                          className="weekday-bar"
                          style={{ height: `${Math.max(2, (sec / maxWeekday) * 100)}%` }}
                        />
                      </div>
                      <span className="weekday-label">{WEEKDAYS[i]}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <p className="hint">
              {stats.trackingSince
                ? `buffd zeichnet deine Sitzungen seit dem ${new Date(
                    stats.trackingSince * 1000
                  ).toLocaleDateString('de-DE', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })} auf (${stats.sessionsCount} Sitzungen). `
                : ''}
              Heatmap und Wochentage zeigen nur die von buffd selbst gemessene Zeit — die von Steam
              übernommene Spielzeit fließt in die Gesamtzahlen ein, hat aber keinen Zeitpunkt.
            </p>
          </>
        )}
      </main>
    </div>
  )
}

export default StatsView

import { useEffect, useState } from 'react'
import { BarChart3, RefreshCw, Clock, CalendarDays, Calendar, Gamepad2 } from 'lucide-react'
import type { PlayStatsResult } from '@shared/types'
import { formatPlaytime } from './format'
import { gradientFor } from './heroArt'

// Statistik (Redesign nach Entwurf „Statistik"): KPI-Karten, Aktivitäts-Heatmap
// (16 Wochen), Meistgespielt-Liste und Wochentags-Verteilung. Datenquelle wie
// bisher `getPlayStats()` — Heatmap/Wochentage zeigen nur die SELBST gemessene
// Zeit; Steam-Spielzeit fließt nur in die Gesamtzahlen (ohne Zeitpunkt).

const WD_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const WD_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']

/** Intensitätsstufe 0–4 einer Heatmap-Zelle relativ zum aktivsten Tag. */
function heatLevel(sec: number, max: number): number {
  if (sec <= 0 || max <= 0) return 0
  const r = sec / max
  if (r > 0.66) return 4
  if (r > 0.33) return 3
  if (r > 0.1) return 2
  return 1
}

/** Sekunden -> { h, m } für die große KPI-Zahl mit getrennten Einheiten. */
function splitHM(sec: number): { h: number; m: number } {
  return { h: Math.floor(sec / 3600), m: Math.floor((sec % 3600) / 60) }
}

/** Große KPI-Zahl: „4886h 9min" mit kleinen Einheiten-Labels. */
function BigTime({ sec }: { sec: number }): JSX.Element {
  const { h, m } = splitHM(sec)
  return (
    <>
      {h > 0 && (
        <>
          {h}
          <span className="st-unit">h</span>
        </>
      )}
      {m}
      <span className="st-unit">min</span>
    </>
  )
}

function dayTooltip(day: string, sec: number): string {
  const d = new Date(`${day}T00:00:00`)
  const label = d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' })
  return sec > 0 ? `${label}: ${formatPlaytime(sec)}` : `${label}: nichts gespielt`
}

function StatsView(): JSX.Element {
  const [stats, setStats] = useState<PlayStatsResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [stamp, setStamp] = useState('')
  // Spielzeit der NICHT installierten (aber besessenen) Spiele — fließt in die
  // Gesamtspielzeit ein. Wird parallel geholt (Steam-Besitz-Katalog/Epic, Netz),
  // damit die Seite nicht darauf wartet; offline bleibt es bei 0.
  const [notInstalledSec, setNotInstalledSec] = useState(0)

  const load = (): void => {
    setLoading(true)
    window.api
      .getPlayStats()
      .then((s) => {
        setStats(s)
        setStamp(
          new Date()
            .toLocaleString('de-DE', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
            .replace(', ', ' · ')
        )
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    window.api
      .listNotInstalledGames()
      .then((r) => setNotInstalledSec(r.ok ? r.games.reduce((a, g) => a + g.playtimeSec, 0) : 0))
      .catch(() => setNotInstalledSec(0))
  }
  useEffect(load, [])

  const maxDaily = stats ? Math.max(1, ...stats.daily.map((d) => d.sec)) : 1
  const maxWeekday = stats ? Math.max(1, ...stats.weekday) : 1
  const maxTop = stats && stats.topGames.length > 0 ? stats.topGames[0].playtimeSec : 1
  const tracked = (stats?.trackedPlaytimeSec ?? 0) > 0

  // Heatmap in Wochen-Spalten (Mo oben … So unten). Leerzellen vor dem ersten
  // Tag, damit die Wochentags-Zeilen stimmen.
  const cells: ({ day: string; sec: number } | null)[] = []
  if (stats && stats.daily.length > 0) {
    const offset = (new Date(`${stats.daily[0].day}T00:00:00`).getDay() + 6) % 7 // Mo=0..So=6
    for (let i = 0; i < offset; i++) cells.push(null)
    cells.push(...stats.daily)
  }
  const weeks: ({ day: string; sec: number } | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const peakWeekday = stats ? stats.weekday.indexOf(Math.max(...stats.weekday)) : -1
  const activeDay = stats && maxWeekday > 1 && peakWeekday >= 0 ? WD_LONG[peakWeekday] : null

  return (
    <div className="app st-view">
      <header className="st-topbar">
        <span className="st-badge">
          <BarChart3 size={22} />
        </span>
        <div className="st-head-titles">
          <h1>Statistik</h1>
          <p>Deine Spielzeit auf einen Blick</p>
        </div>
        <div className="st-spacer" />
        {stamp && (
          <div className="st-stamp">
            <span className="st-stamp-cap">Stand</span>
            <span className="st-stamp-val">{stamp}</span>
          </div>
        )}
        <button className="btn" onClick={load} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'st-spin' : undefined} /> Aktualisieren
        </button>
      </header>

      <main className="content st-content">
        {stats && (
          <>
            {/* KPI-Reihe */}
            <section className="st-kpis">
              <div className="st-kpi">
                <div className="st-kpi-head">
                  <span className="st-kpi-cap">Gesamte Spielzeit</span>
                  <Clock size={18} />
                </div>
                <div className="st-kpi-num">
                  <BigTime sec={stats.totalPlaytimeSec + notInstalledSec} />
                </div>
                <div className="st-kpi-sub">Inkl. nicht installierter Spiele</div>
              </div>

              <div className="st-kpi">
                <div className="st-kpi-head">
                  <span className="st-kpi-cap">Letzte 7 Tage</span>
                  <CalendarDays size={18} />
                </div>
                <div className="st-kpi-num">
                  <BigTime sec={stats.weekSec} />
                </div>
                <div className="st-kpi-sub mono">Ø {formatPlaytime(Math.round(stats.weekSec / 7))} / Tag</div>
              </div>

              <div className="st-kpi">
                <div className="st-kpi-head">
                  <span className="st-kpi-cap">Letzte 30 Tage</span>
                  <Calendar size={18} />
                </div>
                <div className="st-kpi-num">
                  <BigTime sec={stats.monthSec} />
                </div>
                <div className="st-kpi-sub mono">Ø {formatPlaytime(Math.round(stats.monthSec / 30))} / Tag</div>
              </div>

              <div className="st-kpi">
                <div className="st-kpi-head">
                  <span className="st-kpi-cap">Spiele</span>
                  <Gamepad2 size={18} />
                </div>
                <div className="st-kpi-num">
                  {stats.gamesPlayed}
                  <span className="st-unit">gespielt</span>
                </div>
                <div className="st-kpi-sub mono">
                  <span className="st-kpi-dot" />
                  {stats.gamesNeverPlayed} ungespielt · {stats.gamesTotal} gesamt
                </div>
              </div>
            </section>

            {/* Aktivitäts-Heatmap + Info-Karte */}
            <section className="st-heat-section">
              <div className="st-card">
                <div className="st-card-head">
                  <span className="st-cap">Aktivität · letzte 16 Wochen</span>
                  <div className="st-legend">
                    weniger
                    {[0, 1, 2, 3, 4].map((l) => (
                      <span key={l} className={`st-swatch st-lvl-${l}`} />
                    ))}
                    mehr
                  </div>
                </div>
                {tracked ? (
                  <div className="st-heat-body">
                    <div className="st-heat-labels">
                      {WD_SHORT.map((w, i) => (
                        <span key={w}>{i % 2 === 0 ? w : ''}</span>
                      ))}
                    </div>
                    <div className="st-heat-weeks">
                      {weeks.map((week, wi) => (
                        <div key={wi} className="st-week">
                          {week.map((c, di) =>
                            c ? (
                              <span
                                key={c.day}
                                className={`st-cell st-lvl-${heatLevel(c.sec, maxDaily)}`}
                                title={dayTooltip(c.day, c.sec)}
                              />
                            ) : (
                              <span key={`pad-${wi}-${di}`} className="st-cell st-pad" />
                            )
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="st-empty">
                    Hier entsteht deine Spiel-Heatmap, sobald buffd Sitzungen aufzeichnet — starte
                    einfach ein paar Spiele über die App.
                  </p>
                )}
              </div>

              <div className="st-info">
                <div className="st-info-block">
                  <span className="st-info-cap">Aufgezeichnet seit</span>
                  <span className="st-info-val">
                    {stats.trackingSince
                      ? new Date(stats.trackingSince * 1000).toLocaleDateString('de-DE', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })
                      : '—'}
                  </span>
                </div>
                <div className="st-info-div" />
                <div className="st-info-block">
                  <span className="st-info-cap">Sitzungen</span>
                  <span className="st-info-val big">{stats.sessionsCount}</span>
                </div>
                <div className="st-info-div" />
                <div className="st-info-block">
                  <span className="st-info-cap">Aktivster Tag</span>
                  <span className="st-info-val">
                    {activeDay ? (
                      <>
                        <span className="st-info-dot" />
                        {activeDay}
                      </>
                    ) : (
                      '—'
                    )}
                  </span>
                </div>
              </div>
            </section>

            {/* Meistgespielt + Wochentage */}
            <section className="st-bottom">
              <div className="st-card">
                <div className="st-card-head">
                  <span className="st-cap">Meistgespielt</span>
                  <span className="st-cap-sub">nach Gesamtspielzeit</span>
                </div>
                {stats.topGames.length > 0 ? (
                  <div className="st-top-list">
                    {stats.topGames.map((g, i) => (
                      <div key={g.platform + g.name} className="st-top-row" title={g.name}>
                        <span className="st-rank">{i + 1}</span>
                        <span className="st-tile" style={{ backgroundImage: gradientFor(g.name) }}>
                          {g.name.trim()[0]?.toUpperCase() ?? '?'}
                        </span>
                        <div className="st-top-main">
                          <div className="st-top-line">
                            <span className="st-top-name">{g.name}</span>
                            <span className="st-top-time">{formatPlaytime(g.playtimeSec)}</span>
                          </div>
                          <div className="st-top-bar">
                            <div
                              className="st-top-fill"
                              style={{ width: `${Math.max(3, (g.playtimeSec / maxTop) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="st-empty">Noch keine Spielzeit erfasst.</p>
                )}
              </div>

              <div className="st-card">
                <div className="st-card-head col">
                  <span className="st-cap">Wann du spielst</span>
                </div>
                <p className="st-weekday-sub">Verteilung der Spielzeit über die Woche</p>
                <div className="st-weekday-chart">
                  {WD_SHORT.map((w, i) => {
                    const isPeak = i === peakWeekday && (stats.weekday[i] ?? 0) > 0
                    return (
                      <div key={w} className="st-wd-col">
                        <div
                          className={`st-wd-bar ${isPeak ? 'peak' : ''}`}
                          style={{ height: `${Math.max(2, ((stats.weekday[i] ?? 0) / maxWeekday) * 100)}%` }}
                          title={formatPlaytime(stats.weekday[i] ?? 0)}
                        />
                        <span className={`st-wd-label ${isPeak ? 'peak' : ''}`}>{w}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>

            <p className="st-note">
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

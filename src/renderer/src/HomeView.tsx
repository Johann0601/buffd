import { useEffect, useMemo, useState } from 'react'
import {
  Search,
  Library,
  Play,
  ChevronRight,
  CircleArrowUp,
  MonitorCog,
  Gamepad2,
  Clock,
  Users
} from 'lucide-react'
import { formatEuro, formatPlaytime, formatLastPlayed } from './format'
import { platformLabel } from './platforms'
import { RotatingArt, artUrls, gradientFor, useGameHeroes } from './heroArt'
import { updateActionFor } from './updateAction'
import type {
  EpicFreeGame,
  EpicSearchResult,
  GameCard,
  NvidiaUpdate,
  PlayStatsResult,
  Platform,
  SteamFriend,
  SteamOffer
} from '@shared/types'
import type { LibrarySub, View } from './App'

/** Quellfarbe für die Status-Punkte (Hero-Meta, Angebote, Updates). */
function sourceColor(p: Platform): string {
  switch (p) {
    case 'steam':
      return '#4a9eff'
    case 'epic':
      return '#d6d6d6'
    case 'battlenet':
      return '#00aeff'
    case 'riot':
      return '#ff4655'
    default:
      return 'var(--accent)'
  }
}

/** Sekunden -> kompakte Stundenangabe, z. B. "18.4h" (für KPI-Zahlen). */
function hoursLabel(sec: number): string {
  const h = sec / 3600
  if (h >= 10) return `${h.toFixed(0)}h`
  if (h >= 1) return `${h.toFixed(1)}h`
  const min = Math.round(sec / 60)
  return `${min}min`
}

/** Ein normalisiertes Angebot aus beliebiger Quelle für die „Angebote"-Reihe. */
type Deal = {
  key: string
  name: string
  source: Platform
  letter: string
  badge: string // z. B. "GRATIS" oder "-40%"
  price: JSX.Element | string
  coverUrl: string | null
  onClick: () => void
}

// Cache über Mounts hinweg: die Startseite wird beim View-Wechsel ab-/aufgebaut.
// Ohne Cache würde jeder Wechsel neu scannen und Angebote/Stats/Freunde übers Netz
// holen (Ruckeln). Mit Cache zeigt der Wechsel sofort den letzten Stand; nur wenn
// älter als HOME_TTL wird im Hintergrund frisch geladen.
const HOME_TTL = 2 * 60 * 1000 // 2 Minuten
type HomeCache = {
  ts: number
  games: GameCard[]
  stats: PlayStatsResult | null
  freeGames: EpicFreeGame[]
  epicOffers: EpicSearchResult[]
  steamOffers: SteamOffer[]
  friends: SteamFriend[]
}
let homeCache: HomeCache | null = null

function HomeView({
  onNavigate,
  onOpenLibrary,
  onOpenGame,
  pendingGames,
  nvidia,
  appUpdateVersion
}: {
  onNavigate: (v: View) => void
  onOpenLibrary: (sub: LibrarySub) => void
  onOpenGame: (gameId: number) => void
  pendingGames: GameCard[]
  nvidia: NvidiaUpdate | null
  appUpdateVersion: string | null
}): JSX.Element {
  const [games, setGames] = useState<GameCard[]>(homeCache?.games ?? [])
  const [stats, setStats] = useState<PlayStatsResult | null>(homeCache?.stats ?? null)
  const [freeGames, setFreeGames] = useState<EpicFreeGame[]>(homeCache?.freeGames ?? [])
  const [epicOffers, setEpicOffers] = useState<EpicSearchResult[]>(homeCache?.epicOffers ?? [])
  const [steamOffers, setSteamOffers] = useState<SteamOffer[]>(homeCache?.steamOffers ?? [])
  const [friends, setFriends] = useState<SteamFriend[]>(homeCache?.friends ?? [])

  useEffect(() => {
    // Cache noch frisch? -> sofortiger Wechsel ohne Neu-Scan/Netz-Abruf.
    if (homeCache && Date.now() - homeCache.ts < HOME_TTL) return
    const c: HomeCache = {
      ts: Date.now(),
      games: homeCache?.games ?? [],
      stats: homeCache?.stats ?? null,
      freeGames: homeCache?.freeGames ?? [],
      epicOffers: homeCache?.epicOffers ?? [],
      steamOffers: homeCache?.steamOffers ?? [],
      friends: homeCache?.friends ?? []
    }
    homeCache = c
    // Sofort den letzten Stand zeigen, parallel im Hintergrund frisch scannen.
    window.api.listGames().then((g) => { setGames(g); c.games = g }).catch(() => {})
    window.api
      .scanLibrary()
      .then((r) => {
        if (r.ok) { setGames(r.games); c.games = r.games }
      })
      .catch(() => {})
    window.api.getPlayStats().then((s) => { setStats(s); c.stats = s }).catch(() => {})
    window.api
      .getEpicFreeGames()
      .then((g) => { const f = g.filter((x) => x.status === 'gratis'); setFreeGames(f); c.freeGames = f })
      .catch(() => {})
    window.api.getEpicOffers().then((o) => { setEpicOffers(o); c.epicOffers = o }).catch(() => {})
    window.api
      .getSteamOffers()
      .then((o) => { const s = o.slice(0, 12); setSteamOffers(s); c.steamOffers = s })
      .catch(() => {})
    window.api
      .getSteamFriends()
      .then((r) => { setFriends(r.friends); c.friends = r.friends })
      .catch(() => {})
  }, [])

  const playable = useMemo(() => games.filter((g) => g.kind === 'game'), [games])
  const recent = useMemo(
    () =>
      playable
        .filter((g) => g.lastPlayed)
        .sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0)),
    [playable]
  )
  const hero = recent[0] ?? null
  const recentRow = recent.slice(0, 6)

  // Hero-Banner für Hero + „Letzte Spiele" laden (gecacht, gemeinsamer Crossfade).
  const heroTargets = useMemo(
    () => (hero ? [hero, ...recentRow] : recentRow).filter((g): g is GameCard => !!g),
    [hero, recentRow]
  )
  const heroes = useGameHeroes(heroTargets)

  // Angebote quellenübergreifend zusammenführen (Gratis zuerst), max. 5.
  const deals = useMemo<Deal[]>(() => {
    const list: Deal[] = []
    for (const g of freeGames) {
      list.push({
        key: `free:${g.title}`,
        name: g.title,
        source: 'epic',
        letter: g.title.trim()[0]?.toUpperCase() ?? '?',
        badge: 'GRATIS',
        price: g.originalPrice ? `statt ${g.originalPrice}` : 'kostenlos',
        coverUrl: g.wideCoverUrl ?? g.coverUrl,
        onClick: () => g.storeUrl && window.open(g.storeUrl, '_blank')
      })
    }
    for (const o of steamOffers) {
      list.push({
        key: `steam:${o.appId}`,
        name: o.name,
        source: 'steam',
        letter: o.name.trim()[0]?.toUpperCase() ?? '?',
        badge: `-${o.discountPercent}%`,
        price: (
          <>
            {o.originalPriceCents !== null && <s>{formatEuro(o.originalPriceCents)}</s>}{' '}
            <b>{o.finalPriceCents !== null ? formatEuro(o.finalPriceCents) : ''}</b>
          </>
        ),
        coverUrl: o.coverUrl,
        onClick: () => window.open(o.storeUrl, '_blank')
      })
    }
    for (const o of epicOffers) {
      if (o.discountPct <= 0) continue
      list.push({
        key: `epic:${o.id}`,
        name: o.name,
        source: 'epic',
        letter: o.name.trim()[0]?.toUpperCase() ?? '?',
        badge: `-${o.discountPct}%`,
        price: (
          <>
            {o.originalCents !== null && <s>{formatEuro(o.originalCents)}</s>}{' '}
            <b>{o.priceCents !== null ? formatEuro(o.priceCents) : ''}</b>
          </>
        ),
        coverUrl: o.coverUrl,
        onClick: () => o.storeUrl && window.open(o.storeUrl, '_blank')
      })
    }
    return list.slice(0, 5)
  }, [freeGames, steamOffers, epicOffers])

  // 7-Tage-Spielzeit aus dem lückenlosen Tagesraster (nur getrackte Zeit).
  const week = useMemo(() => {
    if (!stats) return null
    const days = stats.daily.slice(-7)
    const max = Math.max(1, ...days.map((d) => d.sec))
    const wdShort = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
    const bars = days.map((d) => {
      const date = new Date(d.day + 'T00:00:00')
      return { label: wdShort[date.getDay()], pct: Math.round((d.sec / max) * 100), sec: d.sec }
    })
    // Trend: diese 7 Tage gegen die 7 davor.
    const prev = stats.daily.slice(-14, -7).reduce((s, d) => s + d.sec, 0)
    const cur = days.reduce((s, d) => s + d.sec, 0)
    const trend = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null
    const peak = bars.reduce((mi, b, i, a) => (b.sec > a[mi].sec ? i : mi), 0)
    return { bars, trend, peak, weekSec: stats.weekSec }
  }, [stats])

  const topGame = stats?.topGames[0] ?? null
  const onlineFriends = friends.filter((f) => f.state !== 'offline')

  // „Updates verfügbar": App-Update + Nvidia-Treiber + ausstehende Spiel-Updates.
  const updateCount =
    (appUpdateVersion ? 1 : 0) + (nvidia?.updateAvailable ? 1 : 0) + pendingGames.length

  return (
    <div className="app home2">
      <header className="home2-topbar">
        <div className="home2-headline">
          <div className="home2-kicker">Übersicht</div>
          <h1 className="home2-title">Start</h1>
        </div>
        <button
          className="home2-search"
          onClick={() => onOpenLibrary('spiele')}
          data-tip="Zur Bibliothek"
        >
          <Search size={16} />
          <span>Bibliothek durchsuchen…</span>
        </button>
        <button className="btn" onClick={() => onOpenLibrary('spiele')}>
          <Library size={15} /> Bibliothek öffnen
        </button>
      </header>

      <main className="content home2-content">
        {/* Hero: zuletzt gespieltes Spiel mit echtem SteamGridDB-Banner */}
        {hero && (
          <section className="home2-hero">
            <RotatingArt
              urls={artUrls(hero, heroes.get(`${hero.platform}:${hero.platformId}`))}
              seed={hero.name}
            />
            <div className="home2-hero-body">
              <div className="home2-hero-kicker">Weiterspielen</div>
              <h2 className="home2-hero-title">{hero.name}</h2>
              <div className="home2-hero-meta">
                <span className="home2-src">
                  <span className="home2-dot" style={{ background: sourceColor(hero.platform) }} />
                  {platformLabel(hero.platform)}
                </span>
                <span>{formatPlaytime(hero.totalPlaytimeSec)} gespielt</span>
                <span>Zuletzt {formatLastPlayed(hero.lastPlayed)}</span>
              </div>
              <div className="home2-hero-actions">
                <button className="btn primary" onClick={() => window.api.launchGame(hero.id)}>
                  <Play size={16} fill="currentColor" /> Spielen
                </button>
                <button className="btn" onClick={() => onOpenGame(hero.id)}>
                  Details
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Letzte Spiele */}
        {recentRow.length > 0 && (
          <section className="home2-section">
            <div className="home2-section-head">
              <div className="home2-section-titles">
                <h3>Letzte Spiele</h3>
                <span>{recent.length} zuletzt gespielt</span>
              </div>
              <button className="home2-link" onClick={() => onOpenLibrary('spiele')}>
                Alle anzeigen <ChevronRight size={14} />
              </button>
            </div>
            <div className="home2-recent-grid">
              {recentRow.map((g) => (
                <div key={g.id} className="home2-card" data-tip={g.name} onClick={() => onOpenGame(g.id)}>
                  <div className="home2-card-art">
                    <RotatingArt
                      urls={artUrls(g, heroes.get(`${g.platform}:${g.platformId}`))}
                      seed={g.name}
                    />
                    <span className="home2-card-src">{platformLabel(g.platform)}</span>
                    {g.updatePending && (
                      <span className="home2-card-update">
                        <CircleArrowUp size={11} /> Update
                      </span>
                    )}
                    <button
                      className="home2-card-play"
                      data-tip={`${g.name} starten`}
                      onClick={(e) => {
                        e.stopPropagation()
                        window.api.launchGame(g.id)
                      }}
                    >
                      <Play size={20} fill="currentColor" />
                    </button>
                  </div>
                  <div className="home2-card-name">{g.name}</div>
                  <div className="home2-card-meta">
                    {formatPlaytime(g.totalPlaytimeSec)} · {formatLastPlayed(g.lastPlayed)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Angebote (quellenübergreifend) */}
        {deals.length > 0 && (
          <section className="home2-section">
            <div className="home2-section-head">
              <div className="home2-section-titles">
                <h3>Angebote</h3>
                <span>Über alle Quellen</span>
              </div>
              <button className="home2-link" onClick={() => onNavigate('shops')}>
                Alle Deals <ChevronRight size={14} />
              </button>
            </div>
            <div className="home2-deals-grid">
              {deals.map((d) => (
                <div
                  key={d.key}
                  className="home2-deal"
                  data-tip={d.name}
                  role="button"
                  tabIndex={0}
                  onClick={d.onClick}
                >
                  <div className="home2-deal-art" style={{ backgroundImage: gradientFor(d.name) }}>
                    {d.coverUrl && (
                      <div
                        className="home2-deal-photo"
                        style={{ backgroundImage: `url("${d.coverUrl}")` }}
                      />
                    )}
                    <span className="home2-deal-letter" aria-hidden>
                      {d.letter}
                    </span>
                    <span className="home2-deal-src">
                      <span className="home2-dot" style={{ background: sourceColor(d.source) }} />
                      {platformLabel(d.source)}
                    </span>
                    <span className={`home2-deal-badge ${d.badge === 'GRATIS' ? 'free' : ''}`}>
                      {d.badge}
                    </span>
                    <h4 className="home2-deal-name">{d.name}</h4>
                  </div>
                  <div className="home2-deal-price">{d.price}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Untere Widget-Reihe: Updates · Spielzeit · Freunde */}
        <section className="home2-grid">
          {/* Updates verfügbar */}
          <div className="home2-widget">
            <div className="home2-widget-head">
              <span className="home2-widget-cap">Updates verfügbar</span>
              <span className="home2-widget-count">
                {updateCount === 0 ? 'nichts offen' : `${updateCount} offen`}
              </span>
            </div>
            {updateCount === 0 && (
              <div className="home2-empty">Alles aktuell — App, Spiele und Treiber.</div>
            )}
            {appUpdateVersion && (
              <div className="home2-update-row">
                <span className="home2-update-icon">
                  <CircleArrowUp size={18} />
                </span>
                <div className="home2-update-main">
                  <div className="home2-update-title">buffd {appUpdateVersion}</div>
                  <div className="home2-update-sub">App-Update bereit</div>
                </div>
                <button className="home2-update-btn" onClick={() => window.api.installAppUpdate()}>
                  Neu starten
                </button>
              </div>
            )}
            {nvidia?.updateAvailable && (
              <div className="home2-update-row">
                <span className="home2-update-icon">
                  <MonitorCog size={18} />
                </span>
                <div className="home2-update-main">
                  <div className="home2-update-title">Nvidia-Treiber {nvidia.latestVersion}</div>
                  <div className="home2-update-sub">installiert: {nvidia.installedVersion}</div>
                </div>
                <button
                  className="home2-update-btn"
                  onClick={async () => {
                    const opened = await window.api.openNvidiaApp()
                    if (!opened && nvidia.downloadUrl) window.open(nvidia.downloadUrl, '_blank')
                  }}
                >
                  NVIDIA App
                </button>
              </div>
            )}
            {pendingGames.map((g) => {
              const action = updateActionFor(g)
              return (
                <div key={g.id} className="home2-update-row">
                  <span className="home2-update-icon">
                    <Gamepad2 size={18} />
                  </span>
                  <div className="home2-update-main">
                    <div className="home2-update-title">{g.name}</div>
                    <div className="home2-update-sub">
                      Update steht aus ({g.platform === 'battlenet' ? 'Battle.net' : 'Steam'})
                    </div>
                  </div>
                  {action && (
                    <button className="home2-update-btn" onClick={action.run}>
                      Update
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Spielzeit · Diese Woche */}
          <div className="home2-widget">
            <div className="home2-widget-cap">
              <Clock size={12} /> Spielzeit · Diese Woche
            </div>
            <div className="home2-week-top">
              <span className="home2-week-num">{week ? hoursLabel(week.weekSec) : '—'}</span>
              {week?.trend != null && (
                <span className={`home2-week-trend ${week.trend < 0 ? 'down' : ''}`}>
                  {week.trend >= 0 ? '+' : ''}
                  {week.trend}%
                </span>
              )}
            </div>
            <div className="home2-week-chart">
              {(week?.bars ?? Array.from({ length: 7 }, () => ({ label: '', pct: 0, sec: 0 }))).map(
                (b, i) => (
                  <div key={i} className="home2-week-col">
                    <div
                      className={`home2-week-bar ${week && i === week.peak && b.sec > 0 ? 'peak' : ''}`}
                      style={{ height: `${Math.max(3, b.pct)}%` }}
                    />
                    <span className="home2-week-day">{b.label}</span>
                  </div>
                )
              )}
            </div>
            <div className="home2-week-foot">
              <span>Meistgespielt</span>
              <span className="home2-week-foot-game">{topGame ? topGame.name : '—'}</span>
            </div>
          </div>

          {/* Freunde-Aktivität */}
          <div className="home2-widget">
            <div className="home2-widget-head">
              <span className="home2-widget-cap">
                <Users size={12} /> Freunde-Aktivität
              </span>
              <span className="home2-widget-count ok">{onlineFriends.length} online</span>
            </div>
            {onlineFriends.length === 0 && (
              <div className="home2-empty">Niemand online — oder kein Steam-Key hinterlegt.</div>
            )}
            {onlineFriends.slice(0, 4).map((f) => (
              <div key={f.steamId} className="home2-friend-row">
                <div className="home2-friend-av" style={{ backgroundImage: gradientFor(f.personaName) }}>
                  {f.avatarUrl ? (
                    <img src={f.avatarUrl} alt="" />
                  ) : (
                    <span>{f.personaName.trim()[0]?.toUpperCase() ?? '?'}</span>
                  )}
                  <span
                    className="home2-friend-dot"
                    style={{
                      background:
                        f.state === 'ingame'
                          ? 'var(--accent)'
                          : f.state === 'online'
                            ? 'var(--ok)'
                            : '#e0b341'
                    }}
                  />
                </div>
                <div className="home2-friend-main">
                  <div className="home2-friend-name">{f.personaName}</div>
                  <div className="home2-friend-sub">
                    {f.state === 'ingame' && f.currentGame
                      ? `spielt ${f.currentGame}`
                      : f.state === 'ingame'
                        ? 'im Spiel'
                        : f.state === 'away'
                          ? 'abwesend'
                          : f.state === 'busy'
                            ? 'beschäftigt'
                            : 'online'}
                  </div>
                </div>
              </div>
            ))}
            {friends.length > 0 && (
              <button className="home2-link end" onClick={() => onNavigate('friends')}>
                Alle Freunde <ChevronRight size={14} />
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default HomeView

import { useEffect, useState, type ReactNode } from 'react'
import { House, ArrowRight, Play } from 'lucide-react'
import { formatPlaytime } from './format'
import type {
  EpicFreeGame,
  GameCard,
  LibraryNewsItem,
  PlaytimePeriods,
  SteamFriend,
  SteamOffer,
  WotStatus
} from '@shared/types'
import type { LibrarySub, View } from './App'
import Dashboard from './Dashboard'

function HomeView({
  onNavigate,
  onOpenLibrary,
  onOpenGame
}: {
  onNavigate: (v: View) => void
  onOpenLibrary: (sub: LibrarySub) => void
  onOpenGame: (gameId: number) => void
}): JSX.Element {
  const [games, setGames] = useState<GameCard[]>([])
  const [wot, setWot] = useState<WotStatus | null>(null)
  const [mcCount, setMcCount] = useState<number | null>(null)
  const [freeGames, setFreeGames] = useState<EpicFreeGame[]>([])
  const [steamOffers, setSteamOffers] = useState<SteamOffer[]>([])
  const [news, setNews] = useState<LibraryNewsItem[]>([])
  const [friends, setFriends] = useState<SteamFriend[]>([])
  const [friendsKeyMissing, setFriendsKeyMissing] = useState(false)
  const [periods, setPeriods] = useState<PlaytimePeriods | null>(null)

  useEffect(() => {
    // Sofort den letzten Stand zeigen, parallel im Hintergrund frisch scannen.
    window.api.listGames().then(setGames).catch(() => {})
    window.api
      .scanLibrary()
      .then((r) => {
        if (r.ok) setGames(r.games)
      })
      .catch(() => {})
    window.api.getWotStatus().then(setWot).catch(() => {})
    window.api
      .getMcProfiles()
      .then((p) => setMcCount(p.length))
      .catch(() => {})
    // Beste Angebote für die Startseite (beides öffentliche Endpunkte).
    window.api
      .getEpicFreeGames()
      .then((g) => setFreeGames(g.filter((f) => f.status === 'gratis')))
      .catch(() => {})
    window.api
      .getSteamOffers()
      .then((o) => setSteamOffers(o.slice(0, 12)))
      .catch(() => {})
    // Ein paar aktuelle News aus der Bibliothek (gecacht, daher günstig).
    window.api
      .getLibraryNews()
      .then((r) => setNews(r.items.slice(0, 5)))
      .catch(() => {})
    // Fürs Dashboard: Online-Freunde und Spielzeit-Zeiträume.
    window.api
      .getSteamFriends()
      .then((r) => {
        setFriends(r.friends)
        setFriendsKeyMissing(r.keyMissing)
      })
      .catch(() => {})
    window.api.getPlaytimePeriods().then(setPeriods).catch(() => {})
  }, [])

  const playable = games.filter((g) => g.kind === 'game')
  const launchers = games.filter((g) => g.kind === 'launcher')
  const totalSec = playable.reduce((s, g) => s + g.totalPlaytimeSec, 0)
  const recent = playable
    .filter((g) => g.lastPlayed)
    .sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0))
    .slice(0, 10)

  const wotRestore = wot?.ok ? wot.needsRestore : 0
  const wotActive = wot?.ok ? wot.mods.filter((m) => m.enabled && m.installed).length : null

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1 className="h2-icon">
            <House size={22} /> Startseite
          </h1>
          <span className="subtitle">Willkommen zurück!</span>
        </div>
      </header>

      <main className="content">
        {/* Anpassbares Dashboard (Widgets per Drag & Drop) */}
        <Dashboard
          playable={playable}
          totalSec={totalSec}
          wotRestore={wotRestore}
          wotActive={wotActive}
          mcCount={mcCount}
          friends={friends}
          friendsKeyMissing={friendsKeyMissing}
          periods={periods}
          news={news}
          onOpenLibrary={onOpenLibrary}
          onNavigate={onNavigate}
        />

        {/* Zuletzt gespielt — Karussell wie die Angebote unten */}
        {recent.length > 0 && (
          <>
            <div className="home-offers-head">
              <h2 className="section-title icon-line" style={{ marginTop: 26 }}>
                <Play size={18} /> Zuletzt gespielt
              </h2>
              <button className="btn small" onClick={() => onOpenLibrary('spiele')}>
                Alle ansehen <ArrowRight size={14} />
              </button>
            </div>
            <OfferRow>
              {recent.map((g) => (
                <div key={g.id} className="offer-card recent-card" title={g.name}>
                  <div
                    className="offer-cover tall recent-cover"
                    onClick={() => onOpenGame(g.id)}
                  >
                    {g.coverUrl ? <img src={g.coverUrl} alt={g.name} loading="lazy" /> : <span />}
                    <button
                      className="recent-play"
                      title={`${g.name} starten`}
                      onClick={(e) => {
                        e.stopPropagation()
                        window.api.launchGame(g.id)
                      }}
                    >
                      <Play size={24} fill="currentColor" />
                    </button>
                  </div>
                  <div className="offer-info recent-info" onClick={() => onOpenGame(g.id)}>
                    <div className="offer-name">{g.name}</div>
                    <div className="offer-meta">{formatPlaytime(g.totalPlaytimeSec)}</div>
                  </div>
                </div>
              ))}
            </OfferRow>
          </>
        )}

        {/* Gratis bei Epic — eigene Reihe, hochkant, seitlich scrollbar */}
        {freeGames.length > 0 && (
          <>
            <div className="home-offers-head">
              <h2 className="section-title" style={{ marginTop: 26 }}>
                Gratis bei Epic
              </h2>
              <button className="btn small" onClick={() => onNavigate('shops')}>
                Alle ansehen <ArrowRight size={14} />
              </button>
            </div>
            <OfferRow>
              {freeGames.map((g) => (
                <button
                  key={g.title}
                  className="offer-card epic-card"
                  title="Im Epic Store ansehen"
                  onClick={() => g.storeUrl && window.open(g.storeUrl, '_blank')}
                >
                  <div className="offer-cover tall">
                    {g.coverUrl ? <img src={g.coverUrl} alt={g.title} loading="lazy" /> : <span />}
                    <span className="offer-badge free">GRATIS</span>
                  </div>
                  <div className="offer-info">
                    <div className="offer-name">{g.title}</div>
                    <div className="offer-meta">
                      {g.originalPrice ? `statt ${g.originalPrice}` : 'kostenlos'}
                    </div>
                  </div>
                </button>
              ))}
            </OfferRow>
          </>
        )}

        {/* Steam-Angebote — eigene Reihe, Querformat, seitlich scrollbar */}
        {steamOffers.length > 0 && (
          <>
            <div className="home-offers-head">
              <h2 className="section-title" style={{ marginTop: 26 }}>
                Steam-Angebote
              </h2>
              <button className="btn small" onClick={() => onNavigate('shops')}>
                Alle ansehen <ArrowRight size={14} />
              </button>
            </div>
            <OfferRow>
              {steamOffers.map((o) => (
                <button
                  key={o.appId}
                  className="offer-card steam-card"
                  title="Im Steam Store ansehen"
                  onClick={() => window.open(o.storeUrl, '_blank')}
                >
                  <div className="offer-cover">
                    {o.coverUrl ? <img src={o.coverUrl} alt={o.name} loading="lazy" /> : <span />}
                    <span className="offer-badge discount">-{o.discountPercent}%</span>
                  </div>
                  <div className="offer-info">
                    <div className="offer-name">{o.name}</div>
                    <div className="offer-meta">
                      <s>
                        {o.originalPriceCents !== null
                          ? `${(o.originalPriceCents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`
                          : ''}
                      </s>{' '}
                      <b>
                        {o.finalPriceCents !== null
                          ? `${(o.finalPriceCents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`
                          : ''}
                      </b>
                    </div>
                  </div>
                </button>
              ))}
            </OfferRow>
          </>
        )}

        {/* Launcher-Schnellstart */}
        {launchers.length > 0 && (
          <>
            <h2 className="section-title" style={{ marginTop: 26 }}>
              Launcher
            </h2>
            <div className="launcher-bar">
              {launchers.map((l) => (
                <button
                  key={l.id}
                  className="launcher-chip"
                  onClick={() => window.api.launchGame(l.id)}
                  title={`${l.name} öffnen`}
                >
                  {l.coverUrl ? (
                    <img className="launcher-icon" src={l.coverUrl} alt="" />
                  ) : (
                    <span className="launcher-icon fallback">{l.name.charAt(0)}</span>
                  )}
                  <span className="launcher-name">{l.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

/** Seitlich scrollbare Reihe. Bewusst OHNE Mausrad-Steuerung: Das Rad scrollt
 *  immer die Seite hoch/runter, die Reihe bewegt man am Scrollbalken. */
function OfferRow({ children }: { children: ReactNode }): JSX.Element {
  return <div className="offer-row">{children}</div>
}

export default HomeView

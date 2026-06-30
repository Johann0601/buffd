import type React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  Collection,
  EpicFreeGame,
  GameCard,
  McProfile,
  NotInstalledGame,
  NvidiaUpdate,
  Platform,
  RunningGame,
  WishlistItem
} from '@shared/types'
import {
  Library,
  BarChart3,
  ShoppingCart,
  Newspaper,
  Users,
  Bell,
  Music,
  Settings,
  FlaskConical,
  RefreshCw,
  Filter,
  X,
  Folder,
  FolderOpen,
  Check,
  Pencil,
  Trash2,
  Download,
  ExternalLink,
  CircleArrowUp,
  Play,
  Square,
  Wrench,
  Gamepad2,
  Puzzle,
  ArrowLeft,
  ArrowUp,
  TriangleAlert,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  LayoutGrid,
  List
} from 'lucide-react'
import { formatGameSize, formatLastPlayed, formatPlaytime } from './format'
import { platformLabel } from './platforms'
import { updateActionFor } from './updateAction'
import { uninstallActionFor } from './uninstallAction'
import logoUrl from './assets/logo.svg'
import minecraftIconUrl from './assets/minecraft-icon.svg'
import FriendsForGame from './FriendsForGame'
import FriendsView from './FriendsView'
import GameDetailExtras from './GameDetailExtras'
import HomeView from './HomeView'
import Splash from './Splash'
import Tooltip from './Tooltip'
import ModsView from './ModsView'
import FeedbackView from './FeedbackView'
import NewsView from './NewsView'
import Onboarding from './Onboarding'
import NotificationsView from './NotificationsView'
import SettingsView from './SettingsView'
import ShopsView from './ShopsView'
import SpotifyWidget from './SpotifyWidget'
import StatsView from './StatsView'
import UpdatesView from './UpdatesView'
import MinecraftView from './MinecraftView'

export type View =
  | 'home'
  | 'games' // Tab „Bibliothek" (enthält Unter-Tabs Spiele/Updates/Mods)
  | 'stats'
  | 'shops'
  | 'news'
  | 'friends'
  | 'feedback'
  | 'settings'
  | 'settings-accounts'
  | 'settings-system'
  | 'settings-storage'
  | 'settings-changelog'
  | 'settings-app'

/** Unter-Tabs innerhalb der „Bibliothek". */
export type LibrarySub = 'spiele' | 'updates' | 'mods'

export type Theme = 'dark' | 'light'

// Die App-Hülle: schmale Seitenleiste links (klappt beim Drüberfahren aus),
// daneben die aktive Ansicht.
function App(): JSX.Element {
  const [view, setView] = useState<View>('home') // Startseite ist die erste Ansicht
  const [librarySub, setLibrarySub] = useState<LibrarySub>('spiele') // Unter-Tab der Bibliothek
  const [spotifyOpen, setSpotifyOpen] = useState(false) // Mini-Player-Popup an der Seitenleiste
  const spotifyPopupRef = useRef<HTMLDivElement>(null)
  const spotifyBtnRef = useRef<HTMLButtonElement>(null)
  const [notifOpen, setNotifOpen] = useState(false) // Benachrichtigungs-Popup an der Seitenleiste
  const notifPopupRef = useRef<HTMLDivElement>(null)
  const notifBtnRef = useRef<HTMLButtonElement>(null)
  // Von der Startseite aus kann ein Spiel direkt in der Detailansicht geöffnet werden.
  const [gameToShow, setGameToShow] = useState<number | null>(null)
  // Merkt, ob die Detailansicht von der Startseite aus geöffnet wurde -> dann führt
  // „Zurück" wieder zur Startseite (statt zur Bibliotheks-Übersicht).
  const [gameFromHome, setGameFromHome] = useState(false)
  const [appVersion, setAppVersion] = useState('')
  const [experimental, setExperimental] = useState(false) // Test-/Vorab-Build?
  const [updateVersion, setUpdateVersion] = useState<string | null>(null) // fertig geladenes App-Update
  // Ladescreen beim Start: 'loading' -> 'fading' (blendet aus) -> 'done' (weg).
  const [boot, setBoot] = useState<'loading' | 'fading' | 'done'>('loading')
  const [theme, setTheme] = useState<Theme>(() =>
    localStorage.getItem('theme') === 'light' ? 'light' : 'dark'
  )
  // Seitenleiste ausgeklappt? Per Knopf umschaltbar; Standard: offen.
  const [sidebarPinned, setSidebarPinned] = useState(
    () => localStorage.getItem('sidebar-pinned') !== '0'
  )
  useEffect(() => {
    localStorage.setItem('sidebar-pinned', sidebarPinned ? '1' : '0')
  }, [sidebarPinned])
  // Erste-Schritte-Pop-up nur beim allerersten Start zeigen.
  const [showOnboarding, setShowOnboarding] = useState(
    () => localStorage.getItem('onboarding-done') !== '1'
  )
  const dismissOnboarding = (): void => {
    localStorage.setItem('onboarding-done', '1')
    setShowOnboarding(false)
  }
  // Update-Pop-up: erscheint, sobald ein Update heruntergeladen wurde. Per
  // „Später" ausblendbar (bleibt dann in der 🔔-Glocke verfügbar).
  const [updateDismissed, setUpdateDismissed] = useState(false)

  // Daten für die Benachrichtigungs-Glocke: ausstehende Spiel-Updates,
  // Nvidia-Treiber, Wunschlisten-Rabatte und nicht eingelöste Epic-Gratisspiele.
  const [pendingGames, setPendingGames] = useState<GameCard[]>([])
  const [nvidia, setNvidia] = useState<NvidiaUpdate | null>(null)
  const [wishlistDeals, setWishlistDeals] = useState<WishlistItem[]>([])
  const [epicFreebies, setEpicFreebies] = useState<EpicFreeGame[]>([])
  const [dismissedFreebies, setDismissedFreebies] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('epic-free-dismissed') ?? '[]') as string[]
    } catch {
      return []
    }
  })

  const [refreshing, setRefreshing] = useState(false) // Glocke wird gerade neu geprüft

  // --- Lade-Funktionen der Glocke (wiederverwendbar, auch für „↻ Aktualisieren") ---

  // Wunschlisten-Rabatte aus der DB lesen (ohne neue Preisprüfung).
  const loadDeals = useCallback((): Promise<void> => {
    return window.api
      .getWishlist()
      .then((items) => setWishlistDeals(items.filter((i) => i.discountPct > 0)))
      .catch(() => {})
  }, [])

  // Ausstehende Spiel-Updates aus der (bereits gescannten) Bibliothek lesen.
  const loadPending = useCallback((): Promise<void> => {
    return window.api
      .listGames()
      .then((g) => setPendingGames(g.filter((x) => x.kind === 'game' && x.updatePending)))
      .catch(() => {})
  }, [])

  // Epic-Gratisspiele, die noch NICHT in der Bibliothek sind (braucht Konto).
  const loadFreebies = useCallback(async (): Promise<void> => {
    try {
      const [free, lib] = await Promise.all([
        window.api.getEpicFreeGames(),
        window.api.getEpicLibrary()
      ])
      if (!lib.ok) return // ohne verbundenes Konto keine Erinnerung
      const owned = new Set(lib.games.map((g) => g.title.toLowerCase().trim()))
      setEpicFreebies(
        free.filter((f) => f.status === 'gratis' && !owned.has(f.title.toLowerCase().trim()))
      )
    } catch {
      /* offline o. ä. */
    }
  }, [])

  // Nvidia-Treiber-Update prüfen (nur falls eine Nvidia-GPU steckt).
  const loadNvidia = useCallback(async (): Promise<void> => {
    try {
      const devices = await window.api.getDevices()
      const gpu = devices.find((d) => d.isNvidiaGpu)
      if (gpu) setNvidia(await window.api.checkNvidiaUpdate(gpu.name, gpu.driverVersion))
    } catch {
      /* keine Treiber-Benachrichtigung */
    }
  }, [])

  // „↻ Aktualisieren" in der Glocke: alle Prüfungen frisch anstoßen — inkl.
  // Bibliotheks-Scan (Update-Erkennung) und aktiver Wunschlisten-Preisprüfung.
  const refreshNotifications = useCallback(async (): Promise<void> => {
    setRefreshing(true)
    try {
      await window.api.scanLibrary().catch(() => {}) // frische Spiel-Update-Erkennung
      await Promise.all([
        // App-Update sofort prüfen; bei Fund lädt es im Hintergrund und der
        // onAppUpdateReady-Listener blendet dann die Benachrichtigung ein.
        window.api.checkForAppUpdates().catch(() => {}),
        loadPending(),
        window.api
          .checkWishlistPrices()
          .then((items) => setWishlistDeals(items.filter((i) => i.discountPct > 0)))
          .catch(() => {}),
        loadFreebies(),
        loadNvidia()
      ])
    } finally {
      setRefreshing(false)
    }
  }, [loadPending, loadFreebies, loadNvidia])

  // Erstes Laden + Live-Auffrischung über die Hintergrund-Ereignisse.
  useEffect(() => {
    loadDeals()
    return window.api.onWishlistRefresh(loadDeals) // nach jeder Preisprüfung
  }, [loadDeals])

  useEffect(() => {
    loadFreebies()
  }, [loadFreebies])

  useEffect(() => {
    window.api.getAppVersion().then(setAppVersion).catch(() => {})
    window.api.isExperimentalBuild().then(setExperimental).catch(() => {})
    // Falls der Update-Download schon fertig war, bevor dieser Listener stand:
    // den aktuellen Stand direkt abfragen.
    window.api
      .getAppUpdateStatus()
      .then((v) => v && setUpdateVersion(v))
      .catch(() => {})
    // Steam-Community-Tags beim Start im Hintergrund nachladen (gedrosselt) —
    // unabhängig davon, welche Seite zuerst offen ist (z. B. direkt Statistik).
    window.api.ensureGameTags().catch(() => {})
    return window.api.onAppUpdateReady(setUpdateVersion)
  }, [])

  useEffect(() => {
    loadPending()
    const off = window.api.onGamesRefresh(loadPending) // nach jedem Hintergrund-Scan
    loadNvidia()
    return off
  }, [loadPending, loadNvidia])

  const visibleFreebies = epicFreebies.filter((f) => !dismissedFreebies.includes(f.title))
  const dismissFreebie = (title: string): void => {
    setDismissedFreebies((prev) => {
      const next = [...prev, title]
      localStorage.setItem('epic-free-dismissed', JSON.stringify(next))
      return next
    })
  }

  const notifCount =
    (updateVersion ? 1 : 0) +
    pendingGames.length +
    (nvidia?.updateAvailable ? 1 : 0) +
    wishlistDeals.length +
    visibleFreebies.length

  // Theme als Attribut ans Wurzel-Element — das CSS schaltet darüber um.
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  // Spotify-Popup per Klick außerhalb schließen — OHNE blockierenden Backdrop,
  // damit die Seitenleiste (Hover zum Ausklappen) voll bedienbar bleibt.
  useEffect(() => {
    if (!spotifyOpen) return
    const onDown = (e: MouseEvent): void => {
      const t = e.target as Node
      if (spotifyPopupRef.current?.contains(t) || spotifyBtnRef.current?.contains(t)) return
      setSpotifyOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [spotifyOpen])

  // Benachrichtigungs-Popup per Klick außerhalb schließen (wie bei Spotify).
  useEffect(() => {
    if (!notifOpen) return
    const onDown = (e: MouseEvent): void => {
      const t = e.target as Node
      if (notifPopupRef.current?.contains(t) || notifBtnRef.current?.contains(t)) return
      setNotifOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [notifOpen])

  const inSettings = view.startsWith('settings')

  // Ladescreen steuern: auf die erste Update-Prüfung beim Start warten, dabei mit
  // Mindestdauer (gegen Flackern) und Höchstdauer (offline nicht hängen bleiben).
  useEffect(() => {
    let cancelled = false
    const MIN_MS = 900
    const MAX_MS = 6000
    const started = Date.now()
    const check = window.api.awaitStartupUpdateCheck().catch(() => ({ updateAvailable: false }))
    const limit = new Promise((res) => setTimeout(res, MAX_MS))
    void Promise.race([check, limit]).then(async () => {
      const elapsed = Date.now() - started
      if (elapsed < MIN_MS) await new Promise((r) => setTimeout(r, MIN_MS - elapsed))
      if (cancelled) return
      setBoot('fading')
      setTimeout(() => {
        if (!cancelled) setBoot('done')
      }, 450)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      {boot !== 'done' && <Splash fading={boot === 'fading'} />}
      <Tooltip />
      <div className="shell">
      <button
        className="sidebar-toggle"
        onClick={() => setSidebarPinned((p) => !p)}
        data-tip={sidebarPinned ? 'Seitenleiste einklappen' : 'Seitenleiste ausgeklappt halten'}
      >
        {sidebarPinned ? <ChevronLeft size={22} /> : <ChevronRight size={22} />}
      </button>
      <nav className={`sidebar ${sidebarPinned ? 'pinned' : ''}`}>
        <button
          className={`sidebar-brand ${view === 'home' ? 'active' : ''}`}
          onClick={() => setView('home')}
          data-tip="Zur Startseite"
        >
          <img className="brand-mark" src={logoUrl} alt="" />
          <span className="brand-text nav-label">
            buff<span className="brand-text-accent">d</span>
          </span>
        </button>
        <button
          className={`nav-item ${view === 'games' ? 'active' : ''}`}
          onClick={() => {
            setGameToShow(null) // normaler Einstieg: Übersicht, keine Detailansicht
            setGameFromHome(false)
            setLibrarySub('spiele')
            setView('games')
          }}
          data-tip="Bibliothek"
        >
          <span className="nav-icon">
            <Library size={20} />
          </span>
          <span className="nav-label">Bibliothek</span>
        </button>
        <button
          className={`nav-item ${view === 'stats' ? 'active' : ''}`}
          onClick={() => setView('stats')}
          data-tip="Statistik"
        >
          <span className="nav-icon">
            <BarChart3 size={20} />
          </span>
          <span className="nav-label">Statistik</span>
        </button>
        <button
          className={`nav-item ${view === 'shops' ? 'active' : ''}`}
          onClick={() => setView('shops')}
          data-tip="Shops"
        >
          <span className="nav-icon">
            <ShoppingCart size={20} />
          </span>
          <span className="nav-label">Shops</span>
        </button>
        <button
          className={`nav-item ${view === 'news' ? 'active' : ''}`}
          onClick={() => setView('news')}
          data-tip="News"
        >
          <span className="nav-icon">
            <Newspaper size={20} />
          </span>
          <span className="nav-label">News</span>
        </button>
        <button
          className={`nav-item ${view === 'friends' ? 'active' : ''}`}
          onClick={() => setView('friends')}
          data-tip="Freunde"
        >
          <span className="nav-icon">
            <Users size={20} />
          </span>
          <span className="nav-label">Freunde</span>
        </button>

        <button
          ref={notifBtnRef}
          className={`nav-item nav-bottom ${notifOpen ? 'active' : ''}`}
          onClick={() => setNotifOpen((o) => !o)}
          data-tip="Benachrichtigungen"
        >
          <span className="nav-icon">
            <Bell size={20} />
            {notifCount > 0 && <span className="nav-badge">{notifCount}</span>}
          </span>
          <span className="nav-label">Benachrichtigungen</span>
        </button>
        <button
          ref={spotifyBtnRef}
          className={`nav-item ${spotifyOpen ? 'active' : ''}`}
          onClick={() => setSpotifyOpen((o) => !o)}
          data-tip="Spotify-Player"
        >
          <span className="nav-icon">
            <Music size={20} />
          </span>
          <span className="nav-label">Spotify</span>
        </button>
        <button
          className={`nav-item ${view === 'feedback' ? 'active' : ''}`}
          onClick={() => setView('feedback')}
          data-tip="Feedback senden"
        >
          <span className="nav-icon">
            <MessageSquare size={20} />
          </span>
          <span className="nav-label">Feedback</span>
        </button>
        <button
          className={`nav-item ${inSettings ? 'active' : ''}`}
          onClick={() => setView('settings')}
          data-tip="Einstellungen"
        >
          <span className="nav-icon">
            <Settings size={20} />
          </span>
          <span className="nav-label">Einstellungen</span>
        </button>
        <div className="sidebar-footer">
          {experimental && (
            <span className="exp-badge nav-label" data-tip="Test-/Vorab-Build — keine veröffentlichte Version">
              <FlaskConical size={14} /> Experimenteller Build
            </span>
          )}
          {appVersion && <span className="app-version nav-label">Version {appVersion}</span>}
        </div>
      </nav>
      <div className="shell-content">
        {view === 'home' && (
          <HomeView
            onNavigate={setView}
            onOpenLibrary={(sub) => {
              setGameToShow(null)
              setGameFromHome(false)
              setLibrarySub(sub)
              setView('games')
            }}
            onOpenGame={(id) => {
              setGameToShow(id)
              setGameFromHome(true)
              setLibrarySub('spiele')
              setView('games')
            }}
            pendingGames={pendingGames}
            nvidia={nvidia}
            appUpdateVersion={updateVersion}
          />
        )}
        {view === 'games' && (
          <LibraryView
            initialSelectedId={gameToShow}
            openedFromHome={gameFromHome}
            onExitToHome={() => setView('home')}
            sub={librarySub}
            onSubChange={setLibrarySub}
          />
        )}
        {view === 'stats' && <StatsView />}
        {view === 'shops' && <ShopsView />}
        {view === 'news' && <NewsView />}
        {view === 'friends' && (
          <FriendsView onOpenAccounts={() => setView('settings-accounts')} />
        )}
        {view === 'feedback' && <FeedbackView />}
        {inSettings && (
          <SettingsView view={view} onNavigate={setView} theme={theme} onThemeChange={setTheme} />
        )}
      </div>

      <ScrollTopButton />

      {/* Spotify-Mini-Player: kleines Popup an der Seitenleiste (ohne Backdrop,
          damit die Seitenleiste bedienbar bleibt; schließt per Klick außerhalb). */}
      {spotifyOpen && (
        <div className="spotify-popup" ref={spotifyPopupRef}>
          <SpotifyWidget />
        </div>
      )}

      {/* Benachrichtigungs-Popup an der Seitenleiste (wie Spotify; „Aktualisieren" bleibt drin). */}
      {notifOpen && (
        <div className="notif-popup" ref={notifPopupRef}>
          <NotificationsView
            appUpdateVersion={updateVersion}
            pendingGames={pendingGames}
            nvidia={nvidia}
            wishlistDeals={wishlistDeals}
            epicFreebies={visibleFreebies}
            onDismissFreebie={dismissFreebie}
            onRefresh={refreshNotifications}
            refreshing={refreshing}
          />
        </div>
      )}

      {showOnboarding && (
        <Onboarding
          onClose={dismissOnboarding}
          onOpenAccounts={() => setView('settings-accounts')}
        />
      )}

      {updateVersion && !updateDismissed && !showOnboarding && (
        <div className="modal-backdrop">
          <div className="modal update-prompt">
            <h2 className="h2-icon">
              <CircleArrowUp size={20} /> Update bereit
            </h2>
            <p className="onboard-intro">
              buffd {updateVersion} wurde heruntergeladen. Zum Installieren startet die App nur
              kurz neu — deine Daten bleiben natürlich erhalten.
            </p>
            <div className="onboard-actions">
              <button className="btn" onClick={() => setUpdateDismissed(true)}>
                Später
              </button>
              <button className="btn primary icon-btn" onClick={() => window.api.installAppUpdate()}>
                <CircleArrowUp size={16} /> Jetzt neu starten &amp; aktualisieren
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  )
}

/**
 * „Nach oben"-Knopf: erscheint dezent unten rechts, sobald der Hauptinhalt
 * (`.shell-content`, der einzige Scroll-Container) ein Stück gescrollt ist, und
 * bringt ihn per Klick sanft zurück an den Anfang. Funktioniert auf ALLEN Seiten,
 * da `.shell-content` beim View-Wechsel bestehen bleibt (nur sein Inhalt wechselt).
 * Halbtransparent + klein, damit er keinen Inhalt verdeckt; voll sichtbar erst beim
 * Überfahren. Wird ausgeblendet (kein Fokus/Klick), solange man oben ist.
 */
function ScrollTopButton(): JSX.Element {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = document.querySelector('.shell-content')
    if (!el) return
    const onScroll = (): void => setVisible(el.scrollTop > 400)
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])
  const toTop = (): void => {
    const el = document.querySelector('.shell-content')
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }
  return (
    <button
      className={`scroll-top ${visible ? 'show' : ''}`}
      onClick={toTop}
      data-tip="Nach oben"
      aria-label="Nach oben scrollen"
      tabIndex={visible ? 0 : -1}
    >
      <ArrowUp size={20} />
    </button>
  )
}

// Sortier-Möglichkeiten der Spiele-Seite.
type GameSort = 'playtime' | 'lastPlayed' | 'name' | 'size'

const SORT_OPTIONS: { value: GameSort; label: string }[] = [
  { value: 'playtime', label: 'Spielzeit' },
  { value: 'lastPlayed', label: 'Zuletzt gespielt' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'size', label: 'Größe' }
]

// Sortierung der Sektion „Nicht installiert" (kein „Größe", da nicht installiert).
type NiSort = 'lastPlayed' | 'playtime' | 'name'

const NI_SORT_OPTIONS: { value: NiSort; label: string }[] = [
  { value: 'lastPlayed', label: 'Zuletzt gespielt' },
  { value: 'playtime', label: 'Spielzeit' },
  { value: 'name', label: 'Name (A–Z)' }
]

// Unter-Tab-Leiste der „Bibliothek" (Spiele · Updates · Mods). Wird in die
// Kopfzeile der jeweiligen Unteransicht eingesetzt.
function LibraryTabs({
  active,
  onChange
}: {
  active: LibrarySub
  onChange: (sub: LibrarySub) => void
}): JSX.Element {
  const items: { id: LibrarySub; label: string; Icon: typeof Gamepad2 }[] = [
    { id: 'spiele', label: 'Spiele', Icon: Gamepad2 },
    { id: 'updates', label: 'Updates', Icon: CircleArrowUp },
    { id: 'mods', label: 'Mods', Icon: Puzzle }
  ]
  return (
    <div className="subtabs">
      {items.map(({ id, label, Icon }) => (
        <button
          key={id}
          className={`subtab ${active === id ? 'active' : ''}`}
          onClick={() => onChange(id)}
        >
          <Icon size={16} /> {label}
        </button>
      ))}
    </div>
  )
}

// „Bibliothek": fasst Spiele, Updates und Mods unter einem Tab mit Unter-Tabs
// zusammen. Die Tab-Leiste wird der aktiven Unteransicht in die Kopfzeile gegeben.
function LibraryView({
  initialSelectedId,
  openedFromHome,
  onExitToHome,
  sub,
  onSubChange
}: {
  initialSelectedId: number | null
  openedFromHome?: boolean
  onExitToHome?: () => void
  sub: LibrarySub
  onSubChange: (sub: LibrarySub) => void
}): JSX.Element {
  const tabs = <LibraryTabs active={sub} onChange={onSubChange} />
  if (sub === 'updates') return <UpdatesView tabs={tabs} />
  if (sub === 'mods') return <ModsView tabs={tabs} />
  return (
    <GamesView
      initialSelectedId={initialSelectedId}
      openedFromHome={openedFromHome}
      onExitToHome={onExitToHome}
      tabs={tabs}
    />
  )
}

// Cache über Mounts hinweg: die Bibliothek wird beim View-Wechsel ab-/aufgebaut.
// Ohne Cache würde jeder Wechsel neu scannen + den Besitz-Katalog übers Netz
// holen (Ruckeln). Mit Cache zeigt der Wechsel sofort den letzten Stand; nur wenn
// die Daten älter als GAMES_TTL sind, wird im Hintergrund frisch geladen.
const GAMES_TTL = 2 * 60 * 1000 // 2 Minuten
type GamesCache = {
  ts: number
  games: GameCard[]
  notInstalled: NotInstalledGame[] | null
  niInfo: { steamKeyMissing: boolean; steamLoaded: boolean; epicConnected: boolean } | null
  collections: Collection[]
}
let gamesCache: GamesCache | null = null

function GamesView({
  initialSelectedId = null,
  openedFromHome = false,
  onExitToHome,
  tabs
}: {
  initialSelectedId?: number | null
  openedFromHome?: boolean
  onExitToHome?: () => void
  tabs?: React.ReactNode
}): JSX.Element {
  const [games, setGames] = useState<GameCard[]>(gamesCache?.games ?? [])
  const [running, setRunning] = useState<Map<number, number>>(new Map()) // gameId -> startedAt
  const [selectedId, setSelectedId] = useState<number | null>(initialSelectedId)
  // Wurde die gerade gezeigte Detailansicht direkt von der Startseite geöffnet?
  // Dann führt „Zurück" zur Startseite. Sobald man in der Liste ein Spiel
  // anklickt, gilt das nicht mehr (dann zurück = Übersicht).
  const [fromHome, setFromHome] = useState(openedFromHome && initialSelectedId != null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  // Suche, Plattform-Filter und Sortierung (Filter + Sortierung werden gemerkt).
  const [search, setSearch] = useState('')
  const [platformFilter, setPlatformFilter] = useState<string>(
    () => localStorage.getItem('games-filter-platform') ?? 'all'
  )
  const [sortBy, setSortBy] = useState<GameSort>(() => {
    const saved = localStorage.getItem('games-sort')
    return SORT_OPTIONS.some((o) => o.value === saved) ? (saved as GameSort) : 'playtime'
  })
  // Ansicht der Spiele-Auflistung: Raster (wie bisher) oder dichte Liste (Design C).
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() =>
    localStorage.getItem('games-view') === 'list' ? 'list' : 'grid'
  )
  // Tag-Filter (Steam-Community-Tags), mehrfach wählbar — wird gemerkt.
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('games-filter-tags') ?? '[]') as string[]
    } catch {
      return []
    }
  })
  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedMinecraft, setSelectedMinecraft] = useState(false)
  useEffect(() => {
    localStorage.setItem('games-filter-tags', JSON.stringify(selectedTags))
  }, [selectedTags])
  // Eigene Sammlungen (B3): Liste + Filter (gemerkt) + Verwalten-Popup.
  const [collections, setCollections] = useState<Collection[]>(gamesCache?.collections ?? [])
  const [collectionFilter, setCollectionFilter] = useState<string>(
    () => localStorage.getItem('games-filter-collection') ?? 'all'
  )
  const [manageCollections, setManageCollections] = useState(false)
  const reloadCollections = useCallback(async () => {
    try {
      const list = await window.api.listCollections()
      setCollections(list)
      if (gamesCache) gamesCache.collections = list
    } catch {
      /* ignorieren */
    }
  }, [])
  useEffect(() => {
    reloadCollections()
  }, [reloadCollections])
  useEffect(() => {
    localStorage.setItem('games-filter-collection', collectionFilter)
  }, [collectionFilter])
  // Verweist der Filter auf eine inzwischen gelöschte Sammlung -> zurück auf „Alle".
  useEffect(() => {
    if (collectionFilter !== 'all' && !collections.some((c) => String(c.id) === collectionFilter)) {
      setCollectionFilter('all')
    }
  }, [collections, collectionFilter])
  // Nicht installierte Spiele (Besitz-Katalog) — separat geladen, damit die
  // Seite sofort steht und der (teils langsame) Katalog-Abruf nachrückt.
  const [notInstalled, setNotInstalled] = useState<NotInstalledGame[] | null>(
    gamesCache?.notInstalled ?? null
  )
  const [selectedNi, setSelectedNi] = useState<NotInstalledGame | null>(null) // offene NI-Detailseite
  const [niInfo, setNiInfo] = useState<{
    steamKeyMissing: boolean
    steamLoaded: boolean
    epicConnected: boolean
  } | null>(gamesCache?.niInfo ?? null)
  // Eigene Sortierung für die Sektion „Nicht installiert" (Suche + Plattform-Filter
  // teilen sich die Sektionen mit den installierten Spielen).
  const [niSort, setNiSort] = useState<NiSort>(() => {
    const saved = localStorage.getItem('ni-sort')
    return NI_SORT_OPTIONS.some((o) => o.value === saved) ? (saved as NiSort) : 'lastPlayed'
  })

  useEffect(() => {
    localStorage.setItem('games-filter-platform', platformFilter)
  }, [platformFilter])
  useEffect(() => {
    localStorage.setItem('games-sort', sortBy)
  }, [sortBy])
  useEffect(() => {
    localStorage.setItem('games-view', viewMode)
  }, [viewMode])
  useEffect(() => {
    localStorage.setItem('ni-sort', niSort)
  }, [niSort])

  const reloadGames = useCallback(async () => {
    try {
      const list = await window.api.listGames()
      setGames(list)
      if (gamesCache) gamesCache.games = list
    } catch {
      /* ignorieren */
    }
  }, [])

  // Besitz-Katalog laden (Steam + Epic + DB-Reste). Eigener Aufruf, weil der
  // Netz-Abruf je nach Bibliotheksgröße ein paar Sekunden dauern kann.
  const loadNotInstalled = useCallback(async () => {
    // Nur beim allerersten Laden (noch kein Cache) auf „Lade …" zurücksetzen —
    // beim Auffrischen bleibt die bisherige Liste stehen, damit nichts flackert.
    if (!gamesCache?.notInstalled) setNotInstalled(null)
    try {
      const res = await window.api.listNotInstalledGames()
      const list = res.ok ? res.games : []
      const info = {
        steamKeyMissing: res.steamKeyMissing,
        steamLoaded: res.steamLoaded,
        epicConnected: res.epicConnected
      }
      setNotInstalled(list)
      setNiInfo(info)
      if (gamesCache) {
        gamesCache.notInstalled = list
        gamesCache.niInfo = info
      }
    } catch {
      setNotInstalled([])
    }
  }, [])

  const scan = useCallback(async () => {
    setScanning(true)
    setError(null)
    try {
      const result = await window.api.scanLibrary()
      if (!result.ok) setError(result.error ?? 'Scan fehlgeschlagen.')
      else {
        setGames(result.games)
        if (gamesCache) gamesCache.games = result.games
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setScanning(false)
      loadNotInstalled() // nach dem Scan stimmt die „installiert"-Liste -> Katalog auffrischen
      // Steam-Community-Tags im Hintergrund nachladen (gedrosselt); meldet sich
      // per onGamesRefresh, sobald neue Tags da sind.
      window.api.ensureGameTags().catch(() => {})
    }
  }, [loadNotInstalled])

  // Start: Liste laden, scannen, und auf Wächter-Updates hören.
  useEffect(() => {
    // Cache noch frisch? -> Wechsel zeigt sofort den letzten Stand, kein Neu-Scan
    // und kein Katalog-Abruf übers Netz. Sonst (kalt oder veraltet) frisch laden.
    const fresh = gamesCache && Date.now() - gamesCache.ts < GAMES_TTL
    if (!fresh) {
      gamesCache = {
        ts: Date.now(),
        games: gamesCache?.games ?? [],
        notInstalled: gamesCache?.notInstalled ?? null,
        niInfo: gamesCache?.niInfo ?? null,
        collections: gamesCache?.collections ?? []
      }
      reloadGames()
      scan() // scannt + frischt im finally den Besitz-Katalog auf
    }
    const offTracker = window.api.onTrackerUpdate((list: RunningGame[]) => {
      setRunning(new Map(list.map((r) => [r.gameId, r.startedAt])))
    })
    const offRefresh = window.api.onGamesRefresh(() => reloadGames())
    return () => {
      offTracker()
      offRefresh()
    }
  }, [reloadGames, scan])

  // Sekundentakt für die Live-Spielzeit — nur wenn etwas läuft.
  useEffect(() => {
    if (running.size === 0) return
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(id)
  }, [running])

  // Gesamt-Spielzeit inkl. der aktuell laufenden Sitzung (live).
  const liveTotal = useCallback(
    (game: GameCard): number => {
      const startedAt = running.get(game.id)
      const live = startedAt ? Math.max(0, now - startedAt) : 0
      return game.totalPlaytimeSec + live
    },
    [running, now]
  )

  const selected = useMemo(
    () => games.find((g) => g.id === selectedId) ?? null,
    [games, selectedId]
  )

  // Launcher und echte Spiele getrennt darstellen.
  const launchers = useMemo(() => games.filter((g) => g.kind === 'launcher'), [games])
  const playable = useMemo(() => games.filter((g) => g.kind === 'game'), [games])

  // Minecraft-Launcher (Modrinth, CurseForge, FTB) — für die Minecraft-Kachel.
  const mcLaunchers = useMemo(
    () => launchers.filter((l) => ['modrinth', 'curseforge', 'ftb'].includes(l.platform)),
    [launchers]
  )
  // Alle anderen Launcher ohne Minecraft — für die Chip-Leiste.
  const nonMcLaunchers = useMemo(
    () => launchers.filter((l) => !['modrinth', 'curseforge', 'ftb'].includes(l.platform)),
    [launchers]
  )

  // Spielzeit aus allen MC-Profilen summieren.
  const [mcProfiles, setMcProfiles] = useState<McProfile[]>([])
  useEffect(() => {
    if (mcLaunchers.length === 0) return
    window.api.getMcProfiles().then(setMcProfiles).catch(() => {})
  }, [mcLaunchers.length])
  const mcTotalPlaytimeSec = useMemo(
    () => mcProfiles.reduce((sum, p) => sum + (p.playtimeSec ?? 0), 0),
    [mcProfiles]
  )

  // Nur Plattformen anbieten, von denen es auch Spiele gibt — installiert ODER
  // nicht installiert, da der Filter jetzt für beide Listen gilt.
  const availablePlatforms = useMemo(
    () =>
      [
        ...new Set([
          ...playable.map((g) => g.platform),
          ...(notInstalled ?? []).map((g) => g.source)
        ])
      ] as Platform[],
    [playable, notInstalled]
  )

  // Alle vorhandenen Tags (häufigste zuerst) für die Filterauswahl.
  const availableTags = useMemo(() => {
    const freq = new Map<string, number>()
    for (const g of playable) for (const t of g.tags) freq.set(t, (freq.get(t) ?? 0) + 1)
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de'))
      .map(([t]) => t)
  }, [playable])

  const toggleTag = useCallback((tag: string): void => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }, [])

  // Anzahl aktiver Filter (für die Anzeige am Filter-Knopf) + Zurücksetzen.
  const activeFilterCount =
    (platformFilter !== 'all' ? 1 : 0) +
    (collectionFilter !== 'all' ? 1 : 0) +
    selectedTags.length
  const resetFilters = useCallback((): void => {
    setPlatformFilter('all')
    setCollectionFilter('all')
    setSelectedTags([])
  }, [])

  // Suche + Filter + Sortierung anwenden.
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    const collId = collectionFilter === 'all' ? null : Number(collectionFilter)
    const list = playable.filter(
      (g) =>
        (platformFilter === 'all' || g.platform === platformFilter) &&
        (term === '' || g.name.toLowerCase().includes(term)) &&
        (selectedTags.length === 0 || selectedTags.every((t) => g.tags.includes(t))) &&
        (collId === null || g.collectionIds.includes(collId))
    )
    switch (sortBy) {
      case 'name':
        list.sort((a, b) => a.name.localeCompare(b.name, 'de'))
        break
      case 'lastPlayed':
        list.sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0))
        break
      case 'size':
        list.sort((a, b) => (b.sizeBytes ?? -1) - (a.sizeBytes ?? -1))
        break
      default: // Spielzeit (wie bisher)
        list.sort((a, b) => liveTotal(b) - liveTotal(a))
    }
    return list
  }, [playable, search, platformFilter, sortBy, selectedTags, collectionFilter, liveTotal])

  // Nicht installierte Spiele: dieselbe Suche + derselbe Plattform-Filter wie bei
  // den installierten. Tag-/Sammlungs-Filter gibt es nur für installierte Spiele —
  // sind sie aktiv, werden keine nicht installierten gezeigt (sie können nicht passen).
  const visibleNotInstalled = useMemo(() => {
    if (!notInstalled) return []
    if (selectedTags.length > 0 || collectionFilter !== 'all') return []
    const term = search.trim().toLowerCase()
    const list = notInstalled.filter(
      (g) =>
        (platformFilter === 'all' || g.source === platformFilter) &&
        (term === '' || g.name.toLowerCase().includes(term))
    )
    switch (niSort) {
      case 'name':
        list.sort((a, b) => a.name.localeCompare(b.name, 'de'))
        break
      case 'playtime':
        list.sort((a, b) => b.playtimeSec - a.playtimeSec)
        break
      default: // zuletzt gespielt (mit Spielzeit/Name als Gleichstand-Auflösung)
        list.sort(
          (a, b) =>
            (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0) ||
            b.playtimeSec - a.playtimeSec ||
            a.name.localeCompare(b.name, 'de')
        )
    }
    return list
  }, [notInstalled, search, platformFilter, selectedTags, collectionFilter, niSort])

  // Für die Listenansicht (Design C): sichtbare Spiele nach Quelle gruppieren,
  // größte Gruppe zuerst. Reihenfolge innerhalb der Gruppe folgt der Sortierung.
  const groupedBySource = useMemo(() => {
    const map = new Map<Platform, GameCard[]>()
    for (const g of visible) {
      const arr = map.get(g.platform)
      if (arr) arr.push(g)
      else map.set(g.platform, [g])
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [visible])

  // Minecraft-Kachel/-Zeile nur zeigen, wenn es MC-Launcher gibt und der aktuelle
  // Filter/die Suche dazu passt (gleiche Bedingung in Raster- und Listenansicht).
  const showMinecraft =
    mcLaunchers.length > 0 &&
    (platformFilter === 'all' || ['modrinth', 'curseforge', 'ftb'].includes(platformFilter)) &&
    (search.trim() === '' || 'minecraft'.includes(search.trim().toLowerCase()))

  if (selectedMinecraft) {
    return <MinecraftView onBack={() => setSelectedMinecraft(false)} />
  }

  if (selected) {
    return (
      <GameDetail
        game={selected}
        isRunning={running.has(selected.id)}
        liveTotalSec={liveTotal(selected)}
        onBack={() => {
          if (fromHome && onExitToHome) {
            onExitToHome()
          } else {
            setSelectedId(null)
          }
        }}
        onGamesUpdated={setGames}
        collections={collections}
        onCollectionsChanged={(g, c) => {
          setGames(g)
          setCollections(c)
        }}
      />
    )
  }

  if (selectedNi) {
    return <NotInstalledDetail game={selectedNi} onBack={() => setSelectedNi(null)} />
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>Bibliothek</h1>
          <span className="subtitle">{playable.length} Spiele</span>
        </div>
        {tabs}
        <button className="btn icon-btn" onClick={scan} disabled={scanning}>
          <RefreshCw size={15} /> {scanning ? 'Scanne …' : 'Aktualisieren'}
        </button>
      </header>

      <main className="content">
        {error && (
          <div className="banner error icon-line">
            <TriangleAlert size={16} /> {error}
          </div>
        )}
        {games.length === 0 && !scanning && !error && (
          <div className="empty">Nichts gefunden. Klicke auf „Aktualisieren".</div>
        )}

        {playable.length > 0 && (
          <div className="games-head">
            <h2 className="section-title">
              Spiele
              {visible.length !== playable.length && (
                <span className="games-count">
                  {' '}
                  ({visible.length} von {playable.length})
                </span>
              )}
            </h2>
            <div className="games-toolbar">
              <input
                type="text"
                className="toolbar-input"
                placeholder="Spiel suchen …"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="toolbar-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as GameSort)}
                data-tip="Sortierung"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    Sortieren: {o.label}
                  </option>
                ))}
              </select>
              <button
                className={`toolbar-select filter-toggle icon-btn ${activeFilterCount ? 'active' : ''}`}
                onClick={() => setFilterOpen((o) => !o)}
                data-tip="Nach Plattform, Tags und Sammlungen filtern"
              >
                <Filter size={15} /> Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                {activeFilterCount > 0 && (
                  <span
                    className="filter-clear"
                    role="button"
                    data-tip="Alle Filter zurücksetzen"
                    onClick={(e) => {
                      e.stopPropagation() // nicht das Panel auf-/zuklappen
                      resetFilters()
                    }}
                  >
                    <X size={13} />
                  </span>
                )}
              </button>
              <button
                className="toolbar-select icon-btn"
                onClick={() => setManageCollections(true)}
                data-tip="Sammlungen anlegen, umbenennen oder löschen"
              >
                <Folder size={15} /> Sammlungen
              </button>
              <div className="view-toggle" role="group" aria-label="Ansicht">
                <button
                  className={`view-btn ${viewMode === 'grid' ? 'on' : ''}`}
                  onClick={() => setViewMode('grid')}
                  data-tip="Rasteransicht"
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  className={`view-btn ${viewMode === 'list' ? 'on' : ''}`}
                  onClick={() => setViewMode('list')}
                  data-tip="Listenansicht"
                >
                  <List size={15} />
                </button>
              </div>
            </div>
          </div>
        )}
        {playable.length > 0 && filterOpen && (
          <div className="filter-panel">
            <div className="filter-group">
              <span className="filter-group-label">Plattform</span>
              <div className="filter-chips">
                <button
                  className={`tag-chip ${platformFilter === 'all' ? 'on' : ''}`}
                  onClick={() => setPlatformFilter('all')}
                >
                  Alle
                </button>
                {availablePlatforms.map((p) => (
                  <button
                    key={p}
                    className={`tag-chip ${platformFilter === p ? 'on' : ''}`}
                    onClick={() => setPlatformFilter(p)}
                  >
                    {platformLabel(p)}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <span className="filter-group-label">Sammlungen</span>
              <div className="filter-chips">
                <button
                  className={`tag-chip ${collectionFilter === 'all' ? 'on' : ''}`}
                  onClick={() => setCollectionFilter('all')}
                >
                  Alle
                </button>
                {collections.length === 0 ? (
                  <span className="filter-empty">Noch keine Sammlungen angelegt.</span>
                ) : (
                  collections.map((c) => (
                    <button
                      key={c.id}
                      className={`tag-chip icon-chip ${collectionFilter === String(c.id) ? 'on' : ''}`}
                      onClick={() => setCollectionFilter(String(c.id))}
                    >
                      <Folder size={13} /> {c.name} ({c.gameCount})
                    </button>
                  ))
                )}
              </div>
            </div>

            {availableTags.length > 0 && (
              <div className="filter-group">
                <span className="filter-group-label">Tags (Steam)</span>
                <div className="filter-chips">
                  {availableTags.map((t) => (
                    <button
                      key={t}
                      className={`tag-chip ${selectedTags.includes(t) ? 'on' : ''}`}
                      onClick={() => toggleTag(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeFilterCount > 0 && (
              <button className="tag-chip clear icon-chip" onClick={resetFilters}>
                <X size={13} /> Alle Filter zurücksetzen
              </button>
            )}
          </div>
        )}

        {nonMcLaunchers.length > 0 && (
          <section className="launcher-section">
            <h2 className="section-title">Launcher</h2>
            <div className="launcher-bar">
              {nonMcLaunchers.map((l) => (
                <LauncherChip
                  key={l.id}
                  launcher={l}
                  active={platformFilter === l.platform}
                  onClick={() =>
                    setPlatformFilter((prev) => (prev === l.platform ? 'all' : l.platform))
                  }
                />
              ))}
            </div>
          </section>
        )}

        {playable.length > 0 && visible.length === 0 && (
          <div className="empty">Kein Spiel passt zu Suche/Filter.</div>
        )}
        {viewMode === 'grid' ? (
          <div className="grid">
            {showMinecraft && (
              <MinecraftTile
                launcherCount={mcLaunchers.length}
                totalPlaytimeSec={mcTotalPlaytimeSec}
                onClick={() => {
                  setFromHome(false)
                  setSelectedMinecraft(true)
                }}
              />
            )}
            {visible.map((game) => (
              <GameTile
                key={game.id}
                game={game}
                isRunning={running.has(game.id)}
                liveTotalSec={liveTotal(game)}
                onClick={() => {
                  setFromHome(false)
                  setSelectedId(game.id)
                }}
              />
            ))}
          </div>
        ) : (
          <div className="games-list">
            <div className="games-list-head">
              <span>Spiel</span>
              <span>Spielzeit</span>
              <span>Zuletzt</span>
              <span>Status</span>
              <span>Aktion</span>
            </div>
            {showMinecraft && (
              <div className="game-group">
                <div className="group-head">
                  <span className="group-dot" />
                  <span className="group-name">Minecraft</span>
                  <span className="group-count">{mcLaunchers.length} Launcher</span>
                  <span className="group-total">{formatPlaytime(mcTotalPlaytimeSec)} gesamt</span>
                </div>
                <div
                  className="game-row"
                  data-tip="Minecraft"
                  onClick={() => {
                    setFromHome(false)
                    setSelectedMinecraft(true)
                  }}
                >
                  <div className="row-game">
                    <div className="row-cover">
                      <img src={minecraftIconUrl} alt="Minecraft" />
                    </div>
                    <div className="row-titles">
                      <div className="row-name">Minecraft</div>
                      <div className="row-source">{mcLaunchers.length} Launcher</div>
                    </div>
                  </div>
                  <div className="row-playtime">{formatPlaytime(mcTotalPlaytimeSec)}</div>
                  <div className="row-last">—</div>
                  <div className="row-status">
                    <span className="row-badge ok">● Installiert</span>
                  </div>
                  <div className="row-action">
                    <button
                      className="btn small"
                      onClick={(e) => {
                        e.stopPropagation()
                        setFromHome(false)
                        setSelectedMinecraft(true)
                      }}
                    >
                      Öffnen
                    </button>
                  </div>
                </div>
              </div>
            )}
            {groupedBySource.map(([platform, list]) => (
              <div className="game-group" key={platform}>
                <div className="group-head">
                  <span className="group-dot" />
                  <span className="group-name">{platformLabel(platform)}</span>
                  <span className="group-count">{list.length} Spiele</span>
                  <span className="group-total">
                    {formatPlaytime(list.reduce((s, g) => s + liveTotal(g), 0))} gesamt
                  </span>
                </div>
                {list.map((game) => (
                  <GameRow
                    key={game.id}
                    game={game}
                    isRunning={running.has(game.id)}
                    liveTotalSec={liveTotal(game)}
                    onClick={() => {
                      setFromHome(false)
                      setSelectedId(game.id)
                    }}
                    onLaunch={() => window.api.launchGame(game.id)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Nicht installierte Spiele (Besitz-Katalog) */}
        {notInstalled === null ? (
          <div className="ni-loading">Lade nicht installierte Spiele …</div>
        ) : (
          (notInstalled.length > 0 || niInfo) && (
            <section className="ni-section">
              <div className="games-head">
                <h2 className="section-title">
                  Nicht installiert
                  <span className="games-count">
                    {' '}
                    ({visibleNotInstalled.length}
                    {notInstalled.length !== visibleNotInstalled.length
                      ? ` von ${notInstalled.length}`
                      : ''}
                    )
                  </span>
                </h2>
                {notInstalled.length > 0 && (
                  <div className="games-toolbar">
                    <select
                      className="toolbar-select"
                      value={niSort}
                      onChange={(e) => setNiSort(e.target.value as NiSort)}
                      data-tip="Sortierung"
                    >
                      {NI_SORT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          Sortieren: {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              {niInfo &&
                (() => {
                  const hints: string[] = []
                  if (niInfo.steamKeyMissing)
                    hints.push('Steam-Web-API-Key hinterlegen (Einstellungen → Konten)')
                  else if (!niInfo.steamLoaded)
                    hints.push(
                      'deine Steam-Spieldetails auf „öffentlich" stellen (sonst bleibt der Steam-Katalog leer)'
                    )
                  if (!niInfo.epicConnected)
                    hints.push('Epic-Konto verbinden (Einstellungen → Konten)')
                  return hints.length > 0 ? (
                    <div className="ni-hint">
                      ℹ Für den vollständigen Katalog: {hints.join(' · ')}.
                    </div>
                  ) : null
                })()}
              {visibleNotInstalled.length === 0 ? (
                <div className="empty">
                  {notInstalled.length === 0
                    ? 'Alle bekannten Spiele sind installiert.'
                    : 'Kein Spiel passt zu Suche/Filter.'}
                </div>
              ) : (
                <div className="grid">
                  {visibleNotInstalled.map((game) => (
                    <NotInstalledTile
                      key={`${game.source}:${game.platformId}`}
                      game={game}
                      onClick={() => setSelectedNi(game)}
                    />
                  ))}
                </div>
              )}
            </section>
          )
        )}
      </main>

      {manageCollections && (
        <CollectionsModal
          collections={collections}
          onClose={() => setManageCollections(false)}
          onChanged={(cols) => {
            setCollections(cols)
            reloadGames() // Löschen entfernt Zuordnungen -> Spielkacheln/Filter auffrischen
          }}
        />
      )}
    </div>
  )
}

/** Popup zum Anlegen, Umbenennen und Löschen eigener Sammlungen. */
function CollectionsModal({
  collections,
  onClose,
  onChanged
}: {
  collections: Collection[]
  onClose: () => void
  onChanged: (collections: Collection[]) => void
}): JSX.Element {
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [confirmDel, setConfirmDel] = useState<number | null>(null)

  const create = async (): Promise<void> => {
    const name = newName.trim()
    if (!name) return
    await window.api.createCollection(name)
    setNewName('')
    onChanged(await window.api.listCollections())
  }
  const saveRename = async (): Promise<void> => {
    if (editId === null || !editName.trim()) {
      setEditId(null)
      return
    }
    const cols = await window.api.renameCollection(editId, editName.trim())
    setEditId(null)
    onChanged(cols)
  }
  const remove = async (id: number): Promise<void> => {
    const cols = await window.api.deleteCollection(id)
    setConfirmDel(null)
    onChanged(cols)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal manage-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="h2-icon">
          <Folder size={20} /> Sammlungen verwalten
        </h2>

        <div className="manage-section">
          <div className="manage-label">Neue Sammlung</div>
          <div className="coll-create">
            <input
              type="text"
              className="toolbar-input"
              placeholder="z. B. Mit Freunden, Zum Entspannen …"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
            />
            <button className="btn" onClick={create} disabled={!newName.trim()}>
              + Anlegen
            </button>
          </div>
        </div>

        <div className="manage-section">
          <div className="manage-label">Vorhandene Sammlungen</div>
          {collections.length === 0 ? (
            <div className="manage-hint">Noch keine Sammlungen. Lege oben eine an.</div>
          ) : (
            <div className="coll-list">
              {collections.map((c) => (
                <div key={c.id} className="coll-row">
                  {editId === c.id ? (
                    <>
                      <input
                        autoFocus
                        type="text"
                        className="toolbar-input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveRename()
                          if (e.key === 'Escape') setEditId(null)
                        }}
                      />
                      <button className="btn small icon-only" onClick={saveRename} data-tip="Speichern">
                        <Check size={15} />
                      </button>
                      <button
                        className="btn small icon-only"
                        onClick={() => setEditId(null)}
                        data-tip="Abbrechen"
                      >
                        <X size={15} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="coll-name">
                        {c.name} <span className="coll-count">({c.gameCount})</span>
                      </span>
                      <button
                        className="btn small icon-only"
                        data-tip="Umbenennen"
                        onClick={() => {
                          setEditId(c.id)
                          setEditName(c.name)
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      {confirmDel === c.id ? (
                        <>
                          <button className="btn small danger" onClick={() => remove(c.id)}>
                            Wirklich löschen?
                          </button>
                          <button className="btn small" onClick={() => setConfirmDel(null)}>
                            Abbrechen
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn small danger icon-only"
                          data-tip="Löschen"
                          onClick={() => setConfirmDel(c.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="onboard-actions">
          <button className="btn" onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
    </div>
  )
}

/** Eine Kachel für ein besessenes, aber nicht installiertes Spiel. */
function NotInstalledTile({
  game,
  onClick
}: {
  game: NotInstalledGame
  onClick: () => void
}): JSX.Element {
  const [failed, setFailed] = useState(false)
  const isLogo =
    !!game.coverUrl &&
    (game.coverUrl.includes('upload.wikimedia.org') || game.coverUrl.startsWith('cover://xbox/'))

  const install = (e: React.MouseEvent): void => {
    e.stopPropagation() // Klick auf „Installieren" öffnet NICHT die Detailseite
    if (game.installUrl) window.open(game.installUrl) // steam://install/… bzw. Epic-Protokoll
    else window.api.openPlatformLauncher(game.source) // Launcher ohne Direkt-Link
  }

  return (
    <div className="tile not-installed" data-tip={game.name} onClick={onClick}>
      <div className="cover">
        {game.coverUrl && !failed ? (
          <img
            src={game.coverUrl}
            alt={game.name}
            className={isLogo ? 'logo-cover' : undefined}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="cover-fallback">{game.name.charAt(0).toUpperCase()}</div>
        )}
        <span className="ni-badge">{platformLabel(game.source)}</span>
        <button className="ni-install icon-btn" onClick={install}>
          {game.installUrl ? (
            <>
              <Download size={15} /> Installieren
            </>
          ) : (
            <>
              <ExternalLink size={15} /> Launcher öffnen
            </>
          )}
        </button>
      </div>
      <div className="tile-info">
        <div className="tile-name">{game.name}</div>
        <div className="tile-meta">
          {game.playtimeSec > 0 ? formatPlaytime(game.playtimeSec) : 'Nie gespielt'}
          {game.lastPlayed ? ` · ${formatLastPlayed(game.lastPlayed)}` : ''}
        </div>
      </div>
    </div>
  )
}

function Cover({ game }: { game: GameCard }): JSX.Element {
  const [failed, setFailed] = useState(false)
  if (game.coverUrl && !failed) {
    // Wikipedia-Logos und quadratische Xbox-Logos -> eingepasst statt beschnitten.
    const isLogo =
      game.coverUrl.includes('upload.wikimedia.org') || game.coverUrl.startsWith('cover://xbox/')
    return (
      <img
        src={game.coverUrl}
        alt={game.name}
        className={isLogo ? 'logo-cover' : undefined}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    )
  }
  return <div className="cover-fallback">{game.name.charAt(0).toUpperCase()}</div>
}

function LauncherChip({
  launcher,
  active,
  onClick
}: {
  launcher: GameCard
  active: boolean
  onClick: () => void
}): JSX.Element {
  return (
    <button
      className={`launcher-chip ${active ? 'active' : ''}`}
      onClick={onClick}
      data-tip={
        active
          ? `Filter „${launcher.name}" aufheben`
          : `Nur ${launcher.name}-Spiele anzeigen`
      }
    >
      {launcher.coverUrl ? (
        <img className="launcher-icon" src={launcher.coverUrl} alt={launcher.name} />
      ) : (
        <span className="launcher-icon fallback">{launcher.name.charAt(0)}</span>
      )}
      <span className="launcher-name">{launcher.name}</span>
    </button>
  )
}

function GameTile({
  game,
  isRunning,
  liveTotalSec,
  onClick
}: {
  game: GameCard
  isRunning: boolean
  liveTotalSec: number
  onClick: () => void
}): JSX.Element {
  return (
    <div className={`tile ${isRunning ? 'running' : ''}`} data-tip={game.name} onClick={onClick}>
      <div className="cover">
        <Cover game={game} />
        {isRunning && <span className="live-dot">● läuft</span>}
        {!isRunning && game.updatePending && (
          <span className="update-dot">
            <CircleArrowUp size={12} /> Update
          </span>
        )}
        <span className="badge">{formatPlaytime(liveTotalSec)}</span>
      </div>
      <div className="tile-info">
        <div className="tile-name">{game.name}</div>
        <div className="tile-meta">Zuletzt: {formatLastPlayed(game.lastPlayed)}</div>
      </div>
    </div>
  )
}

function MinecraftTile({
  launcherCount,
  totalPlaytimeSec,
  onClick
}: {
  launcherCount: number
  totalPlaytimeSec: number
  onClick: () => void
}): JSX.Element {
  return (
    <div className="tile" data-tip="Minecraft" onClick={onClick}>
      <div className="cover">
        <img src={minecraftIconUrl} alt="Minecraft" />
        {totalPlaytimeSec > 0 && (
          <span className="badge">{formatPlaytime(totalPlaytimeSec)}</span>
        )}
      </div>
      <div className="tile-info">
        <div className="tile-name">Minecraft</div>
        <div className="tile-meta">{launcherCount} Launcher</div>
      </div>
    </div>
  )
}

/** Eine Zeile der dichten Listenansicht (Design C): Spiel · Spielzeit · Zuletzt · Status · Aktion. */
function GameRow({
  game,
  isRunning,
  liveTotalSec,
  onClick,
  onLaunch
}: {
  game: GameCard
  isRunning: boolean
  liveTotalSec: number
  onClick: () => void
  onLaunch: () => void
}): JSX.Element {
  return (
    <div className="game-row" onClick={onClick} data-tip={game.name}>
      <div className="row-game">
        <div className="row-cover">
          <Cover game={game} />
        </div>
        <div className="row-titles">
          <div className="row-name">{game.name}</div>
          <div className="row-source">{platformLabel(game.platform)}</div>
        </div>
      </div>
      <div className="row-playtime">{formatPlaytime(liveTotalSec)}</div>
      <div className="row-last">{formatLastPlayed(game.lastPlayed)}</div>
      <div className="row-status">
        {isRunning ? (
          <span className="row-badge live">● läuft</span>
        ) : game.updatePending ? (
          <span className="row-badge update">
            <CircleArrowUp size={11} /> Update
          </span>
        ) : (
          <span className="row-badge ok">● Installiert</span>
        )}
      </div>
      <div className="row-action">
        <button
          className="btn small"
          disabled={isRunning}
          onClick={(e) => {
            e.stopPropagation()
            onLaunch()
          }}
        >
          <Play size={14} /> {isRunning ? 'Läuft' : 'Starten'}
        </button>
      </div>
    </div>
  )
}

/**
 * Sammlungs-Zuordnung eines Spiels: Chips zum An-/Abwählen je Sammlung,
 * plus ein Inline-Feld zum Anlegen einer neuen Sammlung (mit dem Spiel direkt drin).
 */
function CollectionPicker({
  game,
  collections,
  onChanged
}: {
  game: GameCard
  collections: Collection[]
  onChanged: (games: GameCard[], collections: Collection[]) => void
}): JSX.Element {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')

  const toggle = async (id: number): Promise<void> => {
    const next = game.collectionIds.includes(id)
      ? game.collectionIds.filter((c) => c !== id)
      : [...game.collectionIds, id]
    const res = await window.api.setGameCollections(game.id, next)
    onChanged(res.games, res.collections)
  }

  const createWithGame = async (): Promise<void> => {
    const name = newName.trim()
    if (!name) return
    const created = await window.api.createCollection(name)
    const res = await window.api.setGameCollections(game.id, [...game.collectionIds, created.id])
    setNewName('')
    setAdding(false)
    onChanged(res.games, res.collections)
  }

  return (
    <div className="collection-picker">
      <span className="collection-picker-label icon-line">
        <Folder size={14} /> Sammlungen
      </span>
      <div className="collection-chips">
        {collections.map((c) => (
          <button
            key={c.id}
            className={`tag-chip ${game.collectionIds.includes(c.id) ? 'on' : ''}`}
            onClick={() => toggle(c.id)}
          >
            {c.name}
          </button>
        ))}
        {adding ? (
          <span className="collection-add">
            <input
              autoFocus
              type="text"
              placeholder="Name …"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createWithGame()
                if (e.key === 'Escape') {
                  setAdding(false)
                  setNewName('')
                }
              }}
            />
            <button
              className="btn small icon-only"
              onClick={createWithGame}
              disabled={!newName.trim()}
              data-tip="Anlegen"
            >
              <Check size={15} />
            </button>
          </span>
        ) : (
          <button className="tag-chip add" onClick={() => setAdding(true)}>
            + Neu
          </button>
        )}
      </div>
    </div>
  )
}

function GameDetail({
  game,
  isRunning,
  liveTotalSec,
  onBack,
  onGamesUpdated,
  collections,
  onCollectionsChanged
}: {
  game: GameCard
  isRunning: boolean
  liveTotalSec: number
  onBack: () => void
  onGamesUpdated: (games: GameCard[]) => void
  collections: Collection[]
  onCollectionsChanged: (games: GameCard[], collections: Collection[]) => void
}): JSX.Element {
  const [busy, setBusy] = useState<null | 'launch' | 'close'>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [editingHours, setEditingHours] = useState<string | null>(null) // null = nicht im Bearbeiten-Modus
  const [computingSize, setComputingSize] = useState(false)
  const [showManage, setShowManage] = useState(false) // „Verwalten"-Popup

  const computeSize = async (): Promise<void> => {
    setComputingSize(true)
    try {
      await window.api.computeGameSize(game.id)
      onGamesUpdated(await window.api.listGames()) // frische Liste inkl. Größe
    } finally {
      setComputingSize(false)
    }
  }

  const savePlaytime = async (): Promise<void> => {
    const hours = parseFloat((editingHours ?? '').replace(',', '.'))
    if (!Number.isNaN(hours) && hours >= 0) {
      const fresh = await window.api.setImportedPlaytime(game.id, Math.round(hours * 3600))
      onGamesUpdated(fresh)
    }
    setEditingHours(null)
  }

  const launch = async (): Promise<void> => {
    setBusy('launch')
    setNotice(null)
    await window.api.launchGame(game.id)
    // kurz "Starte…" zeigen; der Wächter erkennt den Prozess dann selbst.
    setTimeout(() => setBusy(null), 4000)
  }

  const close = async (): Promise<void> => {
    setBusy('close')
    setNotice('Schließe das Spiel … (das kann ein paar Sekunden dauern)')
    const ok = await window.api.closeGame(game.id)
    setBusy(null)
    setNotice(
      ok
        ? null
        : 'Kein laufender Spielprozess gefunden. Falls das Spiel noch startet, kurz warten und erneut „Schließen" drücken.'
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <button className="btn" onClick={onBack}>
          <ArrowLeft size={16} /> Zurück
        </button>
        <div className="brand">
          <h1>{game.name}</h1>
          {isRunning && <span className="live-dot big">● läuft</span>}
        </div>
        <span />
      </header>

      <main className="content detail">
        <div className="detail-top">
          <div className="detail-cover">
            <Cover game={game} />
          </div>

          <div className="detail-info">
          <h2>{game.name}</h2>

          <div className="stat-row">
            <div className="stat">
              <span className="stat-label">
                Gesamte Spielzeit
                {game.platform === 'epic' && editingHours === null && (
                  <button
                    className="edit-btn"
                    data-tip="Bisherige Spielzeit eintragen (steht in deiner Epic-Bibliothek)"
                    onClick={() => setEditingHours('')}
                  >
                    <Pencil size={13} />
                  </button>
                )}
              </span>
              {editingHours === null ? (
                <span className="stat-value">{formatPlaytime(liveTotalSec)}</span>
              ) : (
                <span className="stat-edit">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Stunden, z. B. 12,5"
                    value={editingHours}
                    onChange={(e) => setEditingHours(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') savePlaytime()
                      if (e.key === 'Escape') setEditingHours(null)
                    }}
                  />
                  <button className="btn small icon-only" onClick={savePlaytime} data-tip="Speichern">
                    <Check size={15} />
                  </button>
                </span>
              )}
            </div>
            <div className="stat">
              <span className="stat-label">Zuletzt gespielt</span>
              <span className="stat-value">{formatLastPlayed(game.lastPlayed)}</span>
            </div>
            {game.platform === 'steam' && (
              <div className="stat">
                <span className="stat-label">Zuletzt aktualisiert</span>
                <span className="stat-value">{formatLastPlayed(game.manifestLastUpdated)}</span>
              </div>
            )}
            {game.installDir && (
              <div className="stat">
                <span className="stat-label">Belegter Speicher</span>
                {game.sizeBytes !== null ? (
                  <span className="stat-value">{formatGameSize(game.sizeBytes)}</span>
                ) : (
                  <button
                    className="btn small"
                    onClick={computeSize}
                    disabled={computingSize}
                    data-tip="Ordnergröße jetzt berechnen"
                  >
                    {computingSize ? 'Berechne …' : 'Berechnen'}
                  </button>
                )}
              </div>
            )}
          </div>

          {game.updatePending && (
            <div className="nvidia-update available" style={{ marginBottom: 22 }}>
              <span className="icon-line">
                <CircleArrowUp size={16} /> Für dieses Spiel steht ein Update aus.
              </span>
              {(() => {
                const action = updateActionFor(game)
                return action ? (
                  <button className="btn small" onClick={action.run}>
                    {action.label}
                  </button>
                ) : null
              })()}
            </div>
          )}

          <div className="actions">
            {!isRunning ? (
              <button className="btn primary" onClick={launch} disabled={busy === 'launch'}>
                {busy === 'launch' ? (
                  'Starte …'
                ) : (
                  <>
                    <Play size={16} /> Starten
                  </>
                )}
              </button>
            ) : (
              <button className="btn danger" onClick={close} disabled={busy === 'close'}>
                {busy === 'close' ? (
                  'Schließe …'
                ) : (
                  <>
                    <Square size={15} /> Schließen
                  </>
                )}
              </button>
            )}
            {game.installDir && (
              <button className="btn" onClick={() => setShowManage(true)} data-tip="Spiel verwalten">
                <Wrench size={16} /> Verwalten
              </button>
            )}
          </div>

            {notice && <div className="notice">{notice}</div>}

            <CollectionPicker
              game={game}
              collections={collections}
              onChanged={onCollectionsChanged}
            />

            <FriendsForGame
              gameRef={{ platform: game.platform, platformId: game.platformId, name: game.name }}
            />
          </div>
        </div>

        <GameDetailExtras
          gameRef={{ platform: game.platform, platformId: game.platformId, name: game.name }}
        />
      </main>

      {showManage && (
        <ManageGameModal
          game={game}
          isRunning={isRunning}
          onClose={() => setShowManage(false)}
          onNotice={setNotice}
        />
      )}
    </div>
  )
}

/** Popup „Verwalten": Installationsordner öffnen oder das Spiel deinstallieren. */
function ManageGameModal({
  game,
  isRunning,
  onClose,
  onNotice
}: {
  game: GameCard
  isRunning: boolean
  onClose: () => void
  onNotice: (text: string | null) => void
}): JSX.Element {
  const [pathError, setPathError] = useState(false)
  const uninstall = uninstallActionFor(game.platform, game.platformId)

  const openFolder = async (): Promise<void> => {
    if (!game.installDir) return
    const ok = await window.api.openGameFolder(game.installDir)
    setPathError(!ok)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal manage-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="h2-icon">
          <Wrench size={20} /> {game.name} verwalten
        </h2>

        <div className="manage-section">
          <div className="manage-label">Installationsordner</div>
          <div className="manage-path">{game.installDir ?? 'Unbekannt'}</div>
          <button className="btn" onClick={openFolder} disabled={!game.installDir}>
            <FolderOpen size={16} /> Im Explorer öffnen
          </button>
          {pathError && (
            <div className="manage-warn">
              Der Ordner wurde nicht gefunden — vielleicht wurde das Spiel verschoben oder bereits
              entfernt.
            </div>
          )}
        </div>

        <div className="manage-section">
          <div className="manage-label">Deinstallieren</div>
          {isRunning ? (
            <div className="manage-warn">Bitte zuerst das laufende Spiel schließen.</div>
          ) : uninstall ? (
            <>
              <button
                className="btn danger"
                onClick={() => {
                  uninstall.run()
                  onNotice(uninstall.hint)
                  onClose()
                }}
              >
                <Trash2 size={16} /> Deinstallieren
              </button>
              <div className="manage-hint">
                {game.platform === 'steam'
                  ? 'Öffnet Steams Bestätigungs-Dialog — es wird nichts sofort gelöscht.'
                  : 'Öffnet den zuständigen Launcher — deinstalliert wird dort.'}
              </div>
            </>
          ) : (
            <div className="manage-hint">
              Für diese Plattform ist kein automatisches Deinstallieren möglich.
            </div>
          )}
        </div>

        <div className="onboard-actions">
          <button className="btn" onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Detailansicht für ein besessenes, aber NICHT installiertes Spiel.
 * Wie die normale Detailseite, aber schreibgeschützt: kein Starten/Schließen,
 * kein Speicherplatz — stattdessen ein „Installieren"-Knopf. Store-Infos,
 * Preise, News und (bei Steam) Erfolge kommen über dieselbe GameRef-Logik.
 */
function NotInstalledDetail({
  game,
  onBack
}: {
  game: NotInstalledGame
  onBack: () => void
}): JSX.Element {
  const install = (): void => {
    if (game.installUrl) window.open(game.installUrl)
    else window.api.openPlatformLauncher(game.source)
  }
  const coverCard: GameCard = {
    id: -1,
    kind: 'game',
    platform: game.source,
    platformId: game.platformId,
    name: game.name,
    installDir: null,
    coverUrl: game.coverUrl,
    totalPlaytimeSec: game.playtimeSec,
    lastPlayed: game.lastPlayed,
    updatePending: false,
    manifestLastUpdated: null,
    sizeBytes: null,
    tags: [],
    collectionIds: []
  }

  return (
    <div className="app">
      <header className="topbar">
        <button className="btn" onClick={onBack}>
          <ArrowLeft size={16} /> Zurück
        </button>
        <div className="brand">
          <h1>{game.name}</h1>
        </div>
        <span />
      </header>

      <main className="content detail">
        <div className="detail-top">
          <div className="detail-cover">
            <Cover game={coverCard} />
          </div>

          <div className="detail-info">
            <h2>{game.name}</h2>

            <div className="stat-row">
              <div className="stat">
                <span className="stat-label">Status</span>
                <span className="stat-value">Nicht installiert</span>
              </div>
              <div className="stat">
                <span className="stat-label">Plattform</span>
                <span className="stat-value">{platformLabel(game.source)}</span>
              </div>
              {game.playtimeSec > 0 && (
                <div className="stat">
                  <span className="stat-label">Bisher gespielt</span>
                  <span className="stat-value">{formatPlaytime(game.playtimeSec)}</span>
                </div>
              )}
              {game.lastPlayed && (
                <div className="stat">
                  <span className="stat-label">Zuletzt gespielt</span>
                  <span className="stat-value">{formatLastPlayed(game.lastPlayed)}</span>
                </div>
              )}
            </div>

            <div className="actions">
              <button className="btn primary icon-btn" onClick={install}>
                {game.installUrl ? (
            <>
              <Download size={15} /> Installieren
            </>
          ) : (
            <>
              <ExternalLink size={15} /> Launcher öffnen
            </>
          )}
              </button>
            </div>

            <FriendsForGame
              gameRef={{ platform: game.source, platformId: game.platformId, name: game.name }}
            />
          </div>
        </div>

        <GameDetailExtras
          gameRef={{ platform: game.source, platformId: game.platformId, name: game.name }}
        />
      </main>
    </div>
  )
}

export default App

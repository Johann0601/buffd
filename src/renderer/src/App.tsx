import type React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  Collection,
  EpicFreeGame,
  GameCard,
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
  TriangleAlert,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { formatGameSize, formatLastPlayed, formatPlaytime } from './format'
import { platformLabel } from './platforms'
import { updateActionFor } from './updateAction'
import { uninstallActionFor } from './uninstallAction'
import logoUrl from './assets/logo.svg'
import FriendsForGame from './FriendsForGame'
import FriendsView from './FriendsView'
import GameDetailExtras from './GameDetailExtras'
import HomeView from './HomeView'
import ModsView from './ModsView'
import NewsView from './NewsView'
import Onboarding from './Onboarding'
import NotificationsView from './NotificationsView'
import SettingsView from './SettingsView'
import ShopsView from './ShopsView'
import SpotifyWidget from './SpotifyWidget'
import StatsView from './StatsView'
import UpdatesView from './UpdatesView'

export type View =
  | 'home'
  | 'games' // Tab „Bibliothek" (enthält Unter-Tabs Spiele/Updates/Mods)
  | 'stats'
  | 'shops'
  | 'news'
  | 'friends'
  | 'notifications'
  | 'settings'
  | 'settings-accounts'
  | 'settings-system'
  | 'settings-storage'
  | 'settings-changelog'

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
  // Von der Startseite aus kann ein Spiel direkt in der Detailansicht geöffnet werden.
  const [gameToShow, setGameToShow] = useState<number | null>(null)
  // Merkt, ob die Detailansicht von der Startseite aus geöffnet wurde -> dann führt
  // „Zurück" wieder zur Startseite (statt zur Bibliotheks-Übersicht).
  const [gameFromHome, setGameFromHome] = useState(false)
  const [appVersion, setAppVersion] = useState('')
  const [experimental, setExperimental] = useState(false) // Test-/Vorab-Build?
  const [updateVersion, setUpdateVersion] = useState<string | null>(null) // fertig geladenes App-Update
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

  const inSettings = view.startsWith('settings')

  return (
    <div className="shell">
      <button
        className="sidebar-toggle"
        onClick={() => setSidebarPinned((p) => !p)}
        title={sidebarPinned ? 'Seitenleiste einklappen' : 'Seitenleiste ausgeklappt halten'}
      >
        {sidebarPinned ? <ChevronLeft size={22} /> : <ChevronRight size={22} />}
      </button>
      <nav className={`sidebar ${sidebarPinned ? 'pinned' : ''}`}>
        <button
          className={`sidebar-brand ${view === 'home' ? 'active' : ''}`}
          onClick={() => setView('home')}
          title="Zur Startseite"
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
          title="Bibliothek"
        >
          <span className="nav-icon">
            <Library size={20} />
          </span>
          <span className="nav-label">Bibliothek</span>
        </button>
        <button
          className={`nav-item ${view === 'stats' ? 'active' : ''}`}
          onClick={() => setView('stats')}
          title="Statistik"
        >
          <span className="nav-icon">
            <BarChart3 size={20} />
          </span>
          <span className="nav-label">Statistik</span>
        </button>
        <button
          className={`nav-item ${view === 'shops' ? 'active' : ''}`}
          onClick={() => setView('shops')}
          title="Shops"
        >
          <span className="nav-icon">
            <ShoppingCart size={20} />
          </span>
          <span className="nav-label">Shops</span>
        </button>
        <button
          className={`nav-item ${view === 'news' ? 'active' : ''}`}
          onClick={() => setView('news')}
          title="News"
        >
          <span className="nav-icon">
            <Newspaper size={20} />
          </span>
          <span className="nav-label">News</span>
        </button>
        <button
          className={`nav-item ${view === 'friends' ? 'active' : ''}`}
          onClick={() => setView('friends')}
          title="Freunde"
        >
          <span className="nav-icon">
            <Users size={20} />
          </span>
          <span className="nav-label">Freunde</span>
        </button>

        <button
          className={`nav-item nav-bottom ${view === 'notifications' ? 'active' : ''}`}
          onClick={() => setView('notifications')}
          title="Benachrichtigungen"
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
          title="Spotify-Player"
        >
          <span className="nav-icon">
            <Music size={20} />
          </span>
          <span className="nav-label">Spotify</span>
        </button>
        <button
          className={`nav-item ${inSettings ? 'active' : ''}`}
          onClick={() => setView('settings')}
          title="Einstellungen"
        >
          <span className="nav-icon">
            <Settings size={20} />
          </span>
          <span className="nav-label">Einstellungen</span>
        </button>
        <div className="sidebar-footer">
          {experimental && (
            <span className="exp-badge nav-label" title="Test-/Vorab-Build — keine veröffentlichte Version">
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
        {view === 'notifications' && (
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
        )}
        {inSettings && (
          <SettingsView view={view} onNavigate={setView} theme={theme} onThemeChange={setTheme} />
        )}
      </div>

      {/* Spotify-Mini-Player: kleines Popup an der Seitenleiste (ohne Backdrop,
          damit die Seitenleiste bedienbar bleibt; schließt per Klick außerhalb). */}
      {spotifyOpen && (
        <div className="spotify-popup" ref={spotifyPopupRef}>
          <SpotifyWidget />
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
  const [games, setGames] = useState<GameCard[]>([])
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
  // Tag-Filter (Steam-Community-Tags), mehrfach wählbar — wird gemerkt.
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('games-filter-tags') ?? '[]') as string[]
    } catch {
      return []
    }
  })
  const [filterOpen, setFilterOpen] = useState(false)
  useEffect(() => {
    localStorage.setItem('games-filter-tags', JSON.stringify(selectedTags))
  }, [selectedTags])
  // Eigene Sammlungen (B3): Liste + Filter (gemerkt) + Verwalten-Popup.
  const [collections, setCollections] = useState<Collection[]>([])
  const [collectionFilter, setCollectionFilter] = useState<string>(
    () => localStorage.getItem('games-filter-collection') ?? 'all'
  )
  const [manageCollections, setManageCollections] = useState(false)
  const reloadCollections = useCallback(async () => {
    try {
      setCollections(await window.api.listCollections())
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
  const [notInstalled, setNotInstalled] = useState<NotInstalledGame[] | null>(null)
  const [selectedNi, setSelectedNi] = useState<NotInstalledGame | null>(null) // offene NI-Detailseite
  const [niInfo, setNiInfo] = useState<{
    steamKeyMissing: boolean
    steamLoaded: boolean
    epicConnected: boolean
  } | null>(null)
  // Eigene Suche/Filter/Sortierung für die Sektion „Nicht installiert".
  const [niSearch, setNiSearch] = useState('')
  const [niPlatformFilter, setNiPlatformFilter] = useState<string>(
    () => localStorage.getItem('ni-filter-platform') ?? 'all'
  )
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
    localStorage.setItem('ni-filter-platform', niPlatformFilter)
  }, [niPlatformFilter])
  useEffect(() => {
    localStorage.setItem('ni-sort', niSort)
  }, [niSort])

  const reloadGames = useCallback(async () => {
    try {
      setGames(await window.api.listGames())
    } catch {
      /* ignorieren */
    }
  }, [])

  // Besitz-Katalog laden (Steam + Epic + DB-Reste). Eigener Aufruf, weil der
  // Netz-Abruf je nach Bibliotheksgröße ein paar Sekunden dauern kann.
  const loadNotInstalled = useCallback(async () => {
    setNotInstalled(null)
    try {
      const res = await window.api.listNotInstalledGames()
      setNotInstalled(res.ok ? res.games : [])
      setNiInfo({
        steamKeyMissing: res.steamKeyMissing,
        steamLoaded: res.steamLoaded,
        epicConnected: res.epicConnected
      })
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
      else setGames(result.games)
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
    reloadGames()
    scan()
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

  // Nur Plattformen anbieten, von denen es auch Spiele gibt.
  const availablePlatforms = useMemo(
    () => [...new Set(playable.map((g) => g.platform))] as Platform[],
    [playable]
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

  // Plattformen, von denen es nicht installierte Spiele gibt.
  const niAvailablePlatforms = useMemo(
    () => [...new Set((notInstalled ?? []).map((g) => g.source))] as Platform[],
    [notInstalled]
  )

  // Nicht installierte Spiele: eigene Suche + Plattform-Filter + Sortierung.
  const visibleNotInstalled = useMemo(() => {
    if (!notInstalled) return []
    const term = niSearch.trim().toLowerCase()
    const list = notInstalled.filter(
      (g) =>
        (niPlatformFilter === 'all' || g.source === niPlatformFilter) &&
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
  }, [notInstalled, niSearch, niPlatformFilter, niSort])

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

        {launchers.length > 0 && (
          <section className="launcher-section">
            <h2 className="section-title">Launcher</h2>
            <div className="launcher-bar">
              {launchers.map((l) => (
                <LauncherChip key={l.id} launcher={l} onLaunch={() => window.api.launchGame(l.id)} />
              ))}
            </div>
          </section>
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
                title="Sortierung"
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
                title="Nach Plattform, Tags und Sammlungen filtern"
              >
                <Filter size={15} /> Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                {activeFilterCount > 0 && (
                  <span
                    className="filter-clear"
                    role="button"
                    title="Alle Filter zurücksetzen"
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
                title="Sammlungen anlegen, umbenennen oder löschen"
              >
                <Folder size={15} /> Sammlungen
              </button>
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
        {playable.length > 0 && visible.length === 0 && (
          <div className="empty">Kein Spiel passt zu Suche/Filter.</div>
        )}
        <div className="grid">
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
                    <input
                      type="text"
                      className="toolbar-input"
                      placeholder="Spiel suchen …"
                      value={niSearch}
                      onChange={(e) => setNiSearch(e.target.value)}
                    />
                    <select
                      className="toolbar-select"
                      value={niPlatformFilter}
                      onChange={(e) => setNiPlatformFilter(e.target.value)}
                      title="Nach Plattform filtern"
                    >
                      <option value="all">Alle Plattformen</option>
                      {niAvailablePlatforms.map((p) => (
                        <option key={p} value={p}>
                          {platformLabel(p)}
                        </option>
                      ))}
                    </select>
                    <select
                      className="toolbar-select"
                      value={niSort}
                      onChange={(e) => setNiSort(e.target.value as NiSort)}
                      title="Sortierung"
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
                      <button className="btn small icon-only" onClick={saveRename} title="Speichern">
                        <Check size={15} />
                      </button>
                      <button
                        className="btn small icon-only"
                        onClick={() => setEditId(null)}
                        title="Abbrechen"
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
                        title="Umbenennen"
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
                          title="Löschen"
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
    <div className="tile not-installed" title={game.name} onClick={onClick}>
      <div className="cover">
        {game.coverUrl && !failed ? (
          <img
            src={game.coverUrl}
            alt={game.name}
            className={isLogo ? 'logo-cover' : undefined}
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
        onError={() => setFailed(true)}
      />
    )
  }
  return <div className="cover-fallback">{game.name.charAt(0).toUpperCase()}</div>
}

function LauncherChip({
  launcher,
  onLaunch
}: {
  launcher: GameCard
  onLaunch: () => void
}): JSX.Element {
  return (
    <button className="launcher-chip" onClick={onLaunch} title={`${launcher.name} öffnen`}>
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
    <div className={`tile ${isRunning ? 'running' : ''}`} title={game.name} onClick={onClick}>
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
              title="Anlegen"
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
                    title="Bisherige Spielzeit eintragen (steht in deiner Epic-Bibliothek)"
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
                  <button className="btn small icon-only" onClick={savePlaytime} title="Speichern">
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
                    title="Ordnergröße jetzt berechnen"
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
              <button className="btn" onClick={() => setShowManage(true)} title="Spiel verwalten">
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

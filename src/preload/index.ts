import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  AchievementsResult,
  Collection,
  DeviceInfo,
  EpicAccountStatus,
  EpicFreeGame,
  EpicLibraryResult,
  EpicSearchResult,
  EpicSyncResult,
  FriendGamesResult,
  FriendsForGameResult,
  GameCard,
  GameDetails,
  GameNewsItem,
  GamePriceInfo,
  GameRef,
  GameScreenshot,
  LibraryNewsResult,
  GameStorageInfo,
  ItadStatus,
  NvidiaUpdate,
  PlaytimePeriods,
  PlayStatsResult,
  RunningGame,
  McProfile,
  McServerStatus,
  NotInstalledResult,
  ScanResult,
  SgdbStatus,
  SpotifyState,
  SpotifyStatus,
  SteamFriendsResult,
  SteamKeyStatus,
  SteamOffer,
  SteamSearchResult,
  UpdateEvent,
  WishlistItem,
  WotStatus
} from '@shared/types'

// Die EINZIGEN Funktionen, die der React-Code aufrufen darf.
// Alles läuft über ipcRenderer.invoke -> ipcMain.handle (Anfrage/Antwort).
const api = {
  getDbStatus: (): Promise<{ ok: boolean; gameCount: number; dbPath: string }> =>
    ipcRenderer.invoke('app:db-status'),

  /** Statistik / Dashboard: aggregierte Spielzeit-Auswertung. */
  getPlayStats: (): Promise<PlayStatsResult> => ipcRenderer.invoke('stats:play'),

  /** Getrackte Spielzeit über 14/30/365 Tage (Startseiten-Widget). */
  getPlaytimePeriods: (): Promise<PlaytimePeriods> => ipcRenderer.invoke('stats:periods'),

  /** News-Feed: neueste News/Patchnotes aller Steam-Spiele gebündelt. */
  getLibraryNews: (force?: boolean): Promise<LibraryNewsResult> =>
    ipcRenderer.invoke('news:library', force),

  /** Aktuelle App-Version (aus package.json). */
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),

  /** true = experimenteller Test-/Vorab-Build (nicht die installierte Release-Version). */
  isExperimentalBuild: (): Promise<boolean> => ipcRenderer.invoke('app:experimental'),

  /** Heruntergeladenes App-Update jetzt installieren (App startet neu). */
  installAppUpdate: (): Promise<void> => ipcRenderer.invoke('app:install-update'),

  /** Beim Start: bereits fertig heruntergeladenes Update (Version) oder null. */
  getAppUpdateStatus: (): Promise<string | null> => ipcRenderer.invoke('app:update-status'),

  /** Sofort auf App-Updates prüfen (manuell). Stößt bei Fund den Download an;
   *  der „update-ready"-Listener meldet sich, wenn er fertig ist. */
  checkForAppUpdates: (): Promise<{
    ok: boolean
    updateAvailable?: boolean
    version?: string
    checkedAt?: number
    reason?: string
  }> => ipcRenderer.invoke('app:check-updates'),

  /** Zeitpunkt (ms) der letzten erfolgreichen App-Update-Prüfung (oder null). */
  getLastUpdateCheck: (): Promise<number | null> => ipcRenderer.invoke('app:last-update-check'),

  /** Der Ladescreen wartet auf die erste App-Update-Prüfung beim Start. Löst auf,
   *  sobald die Prüfung durch ist (oder sofort, wenn ungepackt/kein Updater). */
  awaitStartupUpdateCheck: (): Promise<{ updateAvailable: boolean; version?: string }> =>
    ipcRenderer.invoke('app:startup-check'),

  /** Ist die Feedback-Funktion in diesem Build konfiguriert (Webhook vorhanden)? */
  feedbackAvailable: (): Promise<boolean> => ipcRenderer.invoke('feedback:available'),

  /** Feedback / Bug-Report senden (an den Discord-Kanal), optional mit Anhang. */
  sendFeedback: (
    kind: 'bug' | 'idea' | 'other',
    message: string,
    attachment?: { name: string; mime: string; data: Uint8Array }
  ): Promise<{
    ok: boolean
    reason?: 'noconfig' | 'empty' | 'error' | 'toobig' | 'ratelimited'
    retryAfterMs?: number
  }> => ipcRenderer.invoke('feedback:send', { kind, message, attachment }),

  /** buffd deinstallieren (startet den Uninstaller; nur in der installierten Version).
   *  deleteData = true löscht zusätzlich die eigenen Nutzerdaten (Spielzeit, Einstellungen). */
  uninstallApp: (opts?: {
    deleteData?: boolean
  }): Promise<{ ok: boolean; reason?: 'experimental' }> =>
    ipcRenderer.invoke('app:uninstall', opts),

  /** Meldet sich, wenn ein App-Update fertig heruntergeladen ist (mit Versionsnummer). */
  onAppUpdateReady: (cb: (version: string) => void): (() => void) => {
    const handler = (_e: unknown, version: string): void => cb(version)
    ipcRenderer.on('app:update-ready', handler)
    return () => ipcRenderer.removeListener('app:update-ready', handler)
  },

  /** Komplette Bibliothek scannen (Steam + Epic + Launcher), speichern, zurückgeben. */
  scanLibrary: (): Promise<ScanResult> => ipcRenderer.invoke('library:scan'),

  /** Bereits gespeicherte Spiele aus der DB laden (ohne neuen Scan). */
  listGames: (): Promise<GameCard[]> => ipcRenderer.invoke('games:list'),

  /** Besessene/bekannte, aber nicht installierte Spiele (Steam + Epic + DB-Reste). */
  listNotInstalledGames: (): Promise<NotInstalledResult> =>
    ipcRenderer.invoke('games:not-installed'),

  /** Eigene Sammlungen/Kategorien (B3). */
  listCollections: (): Promise<Collection[]> => ipcRenderer.invoke('collections:list'),
  createCollection: (name: string): Promise<Collection> =>
    ipcRenderer.invoke('collections:create', name),
  renameCollection: (id: number, name: string): Promise<Collection[]> =>
    ipcRenderer.invoke('collections:rename', { id, name }),
  deleteCollection: (id: number): Promise<Collection[]> =>
    ipcRenderer.invoke('collections:delete', id),
  setGameCollections: (
    gameId: number,
    collectionIds: number[]
  ): Promise<{ games: GameCard[]; collections: Collection[] }> =>
    ipcRenderer.invoke('collections:set-for-game', { gameId, collectionIds }),

  /** Steam-Community-Tags für installierte Spiele nachladen (gedrosselt, im
   *  Hintergrund). Meldet sich per onGamesRefresh, wenn neue Tags da sind. */
  ensureGameTags: (): Promise<number> => ipcRenderer.invoke('games:ensure-tags'),

  /** Spiel/Launcher starten (per Eintrags-ID). */
  launchGame: (id: number): Promise<{ ok: boolean }> => ipcRenderer.invoke('game:launch', id),

  /** Den Launcher einer Plattform öffnen (z. B. Battle.net fürs Update). */
  openPlatformLauncher: (platform: string): Promise<boolean> =>
    ipcRenderer.invoke('platform:open-launcher', platform),

  /** Laufendes Spiel schließen. */
  closeGame: (gameId: number): Promise<boolean> => ipcRenderer.invoke('game:close', gameId),

  /** Abonniert die Live-Liste laufender Spiele. Gibt eine Abmelde-Funktion zurück. */
  onTrackerUpdate: (cb: (running: RunningGame[]) => void): (() => void) => {
    const handler = (_e: unknown, data: RunningGame[]): void => cb(data)
    ipcRenderer.on('tracker:update', handler)
    return () => ipcRenderer.removeListener('tracker:update', handler)
  },

  /** Wird ausgelöst, wenn sich Spielzeiten geändert haben (Liste neu laden). */
  onGamesRefresh: (cb: () => void): (() => void) => {
    const handler = (): void => cb()
    ipcRenderer.on('games:refresh', handler)
    return () => ipcRenderer.removeListener('games:refresh', handler)
  },

  /** Phase 6: installierte Geräte + Treiberversionen auslesen. */
  getDevices: (): Promise<DeviceInfo[]> => ipcRenderer.invoke('system:devices'),

  /** Phase 6: Update-Prüfung für eine Nvidia-GPU. */
  checkNvidiaUpdate: (name: string, driverVersion: string): Promise<NvidiaUpdate> =>
    ipcRenderer.invoke('nvidia:check', { name, driverVersion }),

  /** Phase 6: NVIDIA App öffnen (true, wenn gefunden & gestartet). */
  openNvidiaApp: (): Promise<boolean> => ipcRenderer.invoke('nvidia:open-app'),

  /** Phase 3: Update-Historie laden (optional nur für ein Spiel). */
  getUpdateHistory: (gameId?: number): Promise<UpdateEvent[]> =>
    ipcRenderer.invoke('updates:history', gameId),

  /** Spielzeit-Startwert manuell setzen (Sekunden). Gibt die frische Spieleliste zurück. */
  setImportedPlaytime: (gameId: number, seconds: number): Promise<GameCard[]> =>
    ipcRenderer.invoke('game:set-playtime', { gameId, seconds }),

  /** Phase 4: WoT-Mod-Management. */
  getWotStatus: (): Promise<WotStatus> => ipcRenderer.invoke('wot:status'),
  toggleWotMod: (id: number, enable: boolean): Promise<WotStatus> =>
    ipcRenderer.invoke('wot:toggle', { id, enable }),
  addWotMods: (): Promise<WotStatus> => ipcRenderer.invoke('wot:add'),
  openWotModsFolder: (): Promise<void> => ipcRenderer.invoke('wot:open-folder'),

  /** Phase 5: Minecraft-Profile/Modpacks aller Launcher. */
  getMcProfiles: (): Promise<McProfile[]> => ipcRenderer.invoke('mc:profiles'),
  openMcFolder: (path: string): Promise<void> => ipcRenderer.invoke('mc:open-folder', path),
  /** Stufe 1: Minecraft-Server per Server List Ping abfragen (kein API-Key). */
  getMcServers: (): Promise<McServerStatus[]> => ipcRenderer.invoke('mc:servers'),

  /** Konten: Epic-Verbindung verwalten. */
  getEpicStatus: (): Promise<EpicAccountStatus> => ipcRenderer.invoke('epic:status'),
  openEpicLogin: (): Promise<void> => ipcRenderer.invoke('epic:open-login'),
  epicLogin: (
    code: string
  ): Promise<{ ok: true; status: EpicAccountStatus } | { ok: false; error: string }> =>
    ipcRenderer.invoke('epic:login', code),
  epicLogout: (): Promise<EpicAccountStatus> => ipcRenderer.invoke('epic:logout'),
  syncEpicPlaytime: (): Promise<EpicSyncResult> => ipcRenderer.invoke('epic:sync-playtime'),

  /** Shops: Gratisspiele, komplette Epic-Bibliothek, Steam-Angebote. */
  getEpicFreeGames: (): Promise<EpicFreeGame[]> => ipcRenderer.invoke('epic:free-games'),
  getEpicOffers: (): Promise<EpicSearchResult[]> => ipcRenderer.invoke('epic:offers'),
  getEpicLibrary: (): Promise<EpicLibraryResult> => ipcRenderer.invoke('epic:library'),
  getSteamOffers: (): Promise<SteamOffer[]> => ipcRenderer.invoke('steam:offers'),

  /** Detailseiten: Store-Infos, News/Patchnotes und Erfolge zu einem Spiel.
   *  Per GameRef (Plattform+ID+Name) — funktioniert auch für nicht installierte. */
  getGameDetails: (ref: GameRef): Promise<GameDetails> =>
    ipcRenderer.invoke('game:details', ref),
  getGameNews: (ref: GameRef): Promise<GameNewsItem[]> => ipcRenderer.invoke('game:news', ref),
  getGameAchievements: (ref: GameRef): Promise<AchievementsResult> =>
    ipcRenderer.invoke('game:achievements', ref),
  /** Lokal gespeicherte, selbst aufgenommene Screenshots (nur Steam-Spiele). */
  getGameScreenshots: (ref: GameRef): Promise<GameScreenshot[]> =>
    ipcRenderer.invoke('game:screenshots', ref),
  /** Screenshot verwalten (Eingabe ist die shot://-URL des Vollbilds). */
  copyScreenshot: (url: string): Promise<boolean> => ipcRenderer.invoke('screenshot:copy', url),
  revealScreenshot: (url: string): Promise<boolean> =>
    ipcRenderer.invoke('screenshot:reveal', url),
  deleteScreenshot: (url: string): Promise<boolean> =>
    ipcRenderer.invoke('screenshot:delete', url),

  /** Freunde (Stufe A): Steam-Freundesliste + Bibliothek eines Freundes. */
  getSteamFriends: (): Promise<SteamFriendsResult> => ipcRenderer.invoke('friends:list'),
  getFriendGames: (steamId: string): Promise<FriendGamesResult> =>
    ipcRenderer.invoke('friends:games', steamId),
  getFriendsForGame: (appId: number): Promise<FriendsForGameResult> =>
    ipcRenderer.invoke('friends:for-game', appId),

  /** Installationsordner eines Spiels im Datei-Explorer öffnen. */
  openGameFolder: (path: string): Promise<boolean> =>
    ipcRenderer.invoke('game:open-folder', path),

  /** Steam-Web-API-Key (für Erfolge) verwalten. */
  getSteamKeyStatus: (): Promise<SteamKeyStatus> => ipcRenderer.invoke('steamkey:status'),
  setSteamKey: (
    key: string
  ): Promise<{ ok: true; status: SteamKeyStatus } | { ok: false; error: string }> =>
    ipcRenderer.invoke('steamkey:set', key),
  clearSteamKey: (): Promise<SteamKeyStatus> => ipcRenderer.invoke('steamkey:clear'),

  /** SteamGridDB-Key (für bessere Cover) verwalten. */
  getSgdbStatus: (): Promise<SgdbStatus> => ipcRenderer.invoke('sgdb:status'),
  setSgdbKey: (
    key: string
  ): Promise<{ ok: true; upgradedCovers: number } | { ok: false; error: string }> =>
    ipcRenderer.invoke('sgdb:set', key),
  clearSgdbKey: (): Promise<SgdbStatus> => ipcRenderer.invoke('sgdb:clear'),
  /** Bis zu 3 Querformat-„Hero"-Banner (SteamGridDB) für ein Spiel — gecacht in der DB. */
  getGameHero: (ref: { platform: string; platformId: string; name: string }): Promise<string[]> =>
    ipcRenderer.invoke('sgdb:hero', ref),

  /** Speicherplatz-Analyse: gecachter Stand und komplette Neuberechnung. */
  getGameStorage: (): Promise<GameStorageInfo[]> => ipcRenderer.invoke('storage:list'),
  analyzeGameStorage: (): Promise<GameStorageInfo[]> => ipcRenderer.invoke('storage:analyze'),
  computeGameSize: (gameId: number): Promise<number | null> =>
    ipcRenderer.invoke('storage:game', gameId),

  /** Meldet während der Analyse jedes fertig berechnete Spiel einzeln. */
  onStorageProgress: (cb: (info: GameStorageInfo) => void): (() => void) => {
    const handler = (_e: unknown, info: GameStorageInfo): void => cb(info)
    ipcRenderer.on('storage:progress', handler)
    return () => ipcRenderer.removeListener('storage:progress', handler)
  },

  /** Wunschliste mit Preisalarm. */
  getWishlist: (): Promise<WishlistItem[]> => ipcRenderer.invoke('wishlist:list'),
  addToWishlist: (item: {
    appId: string
    name: string
    coverUrl: string | null
    shop?: 'steam' | 'epic'
    storeUrl?: string | null
  }): Promise<WishlistItem[]> => ipcRenderer.invoke('wishlist:add', item),
  removeFromWishlist: (appId: string): Promise<WishlistItem[]> =>
    ipcRenderer.invoke('wishlist:remove', appId),
  checkWishlistPrices: (): Promise<WishlistItem[]> => ipcRenderer.invoke('wishlist:check'),
  importSteamWishlist: (): Promise<{
    ok: boolean
    imported: number
    total: number
    error?: string
  }> => ipcRenderer.invoke('wishlist:import-steam'),

  /** Meldet sich, wenn die regelmäßige Preisprüfung neue Daten hat. */
  onWishlistRefresh: (cb: () => void): (() => void) => {
    const handler = (): void => cb()
    ipcRenderer.on('wishlist:refresh', handler)
    return () => ipcRenderer.removeListener('wishlist:refresh', handler)
  },

  /** Steam-Store-Suche (zum Befüllen der Wunschliste). */
  searchSteamStore: (term: string): Promise<SteamSearchResult[]> =>
    ipcRenderer.invoke('steam:search', term),

  /** Epic-Store-Suche (zum Befüllen der Wunschliste). */
  searchEpicStore: (
    term: string
  ): Promise<{ ok: true; results: EpicSearchResult[] } | { ok: false; error: string }> =>
    ipcRenderer.invoke('epic:search', term),

  /** Preis-Infos zu einem Spiel (Steam + IsThereAnyDeal). */
  getGamePrices: (ref: GameRef): Promise<GamePriceInfo> =>
    ipcRenderer.invoke('game:prices', ref),

  /** Spotify: Verbindung, Wiedergabe-Status und Steuerung (Musik-Widget). */
  getSpotifyStatus: (): Promise<SpotifyStatus> => ipcRenderer.invoke('spotify:status'),
  setSpotifyClientId: (id: string | null): Promise<SpotifyStatus> =>
    ipcRenderer.invoke('spotify:set-client', id),
  spotifyLogin: (): Promise<{ ok: true; status: SpotifyStatus } | { ok: false; error: string }> =>
    ipcRenderer.invoke('spotify:login'),
  spotifyLogout: (): Promise<SpotifyStatus> => ipcRenderer.invoke('spotify:logout'),
  getSpotifyState: (): Promise<SpotifyState> => ipcRenderer.invoke('spotify:state'),
  spotifyControl: (
    action: 'play' | 'pause' | 'next' | 'previous'
  ): Promise<{ ok: boolean; needsPremium?: boolean; error?: string }> =>
    ipcRenderer.invoke('spotify:control', action),

  /** IsThereAnyDeal-Key verwalten. */
  getItadStatus: (): Promise<ItadStatus> => ipcRenderer.invoke('itad:status'),
  setItadKey: (key: string): Promise<{ ok: true } | { ok: false; error: string }> =>
    ipcRenderer.invoke('itad:set', key),
  clearItadKey: (): Promise<ItadStatus> => ipcRenderer.invoke('itad:clear')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}

export type AppApi = typeof api

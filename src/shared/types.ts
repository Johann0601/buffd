// Typen, die sowohl der Main-Prozess als auch der React-Renderer kennen.
// Ein einziger Ort für die "Form" unserer Daten -> keine Doppel-Definitionen.

export type Platform =
  | 'steam'
  | 'epic'
  | 'modrinth'
  | 'curseforge'
  | 'ftb'
  | 'battlenet'
  | 'ubisoft'
  | 'riot'
  | 'rsi'
  | 'ea'
  | 'wargaming'
  | 'rockstar'
  | 'xbox'

/** 'game' = spielbarer Eintrag mit Tracking, 'launcher' = startbare App ohne Tracking. */
export type GameKind = 'game' | 'launcher'

/** Ein Spiel/Launcher, wie es die Oberfläche anzeigt (inkl. berechneter Gesamt-Spielzeit). */
export interface GameCard {
  id: number
  kind: GameKind
  platform: Platform
  platformId: string // bei Steam: die AppID
  name: string
  installDir: string | null
  coverUrl: string | null // 'cover://steam/440', eine data:-URL (Launcher-Icon) oder null
  totalPlaytimeSec: number // Steam-Startwert + selbst getrackte Sitzungen
  lastPlayed: number | null // Unix-Zeit (Sekunden)
  updatePending: boolean // Steam meldet ein ausstehendes Update (StateFlags Bit 2)
  manifestLastUpdated: number | null // letzter Update-Zeitpunkt laut Steam (Unix-Sek.)
  sizeBytes: number | null // Ordnergröße der Installation (null = noch nicht berechnet)
  tags: string[] // Steam-Community-Tags (für den Tag-Filter); leer = noch nicht abgerufen
}

/**
 * Ein besessenes, aber NICHT installiertes Spiel — quellenübergreifend:
 *  - Steam: kompletter Besitz-Katalog (braucht den Web-API-Key)
 *  - Epic:  komplette Bibliothek (braucht das verbundene Konto)
 *  - andere Launcher: nur Spiele, die mal installiert waren (DB merkt sie sich)
 */
export interface NotInstalledGame {
  source: Platform
  platformId: string // Steam-AppID / Epic appName / DB platform_id
  name: string
  coverUrl: string | null
  playtimeSec: number // bekannte Spielzeit (offiziell oder selbst getrackt), 0 = unbekannt
  lastPlayed: number | null // Unix-Sek. — nur Steam (rtime_last_played) + unser Tracking
  installUrl: string | null // Protokoll-URL zum Installieren; null = Launcher öffnen
}

/** Ergebnis des Abrufs nicht installierter (aber besessener/bekannter) Spiele. */
export interface NotInstalledResult {
  ok: boolean
  games: NotInstalledGame[]
  steamKeyMissing: boolean // true = ohne Steam-Key fehlt der Steam-Katalog
  steamLoaded: boolean // false trotz Key = Spieldetails wohl privat
  epicConnected: boolean // false = ohne verbundenes Konto fehlt der Epic-Katalog
  error?: string
}

/**
 * Kennung eines Spiels für Detail-Abrufe (Store-Infos, News, Preise, Erfolge).
 * Bewusst NICHT die DB-ID — so funktionieren die Abrufe auch für nicht
 * installierte Katalog-Spiele, die (noch) keinen DB-Eintrag haben.
 */
export interface GameRef {
  platform: Platform
  platformId: string
  name: string
}

// --- Speicherplatz-Analyse ---

/** Speicherbelegung eines installierten Spiels. */
export interface GameStorageInfo {
  gameId: number
  platformId: string // z. B. Steam-AppID (für den Deinstallieren-Knopf)
  name: string
  platform: Platform
  installDir: string
  sizeBytes: number | null // null = noch nicht berechnet
  checkedAt: number | null // wann zuletzt berechnet (Unix-Sekunden)
  lastPlayed: number | null
}

// --- Phase 5: Minecraft-Profile/Modpacks ---

export type McLauncher = 'modrinth' | 'curseforge' | 'ftb'

/** Ein Minecraft-Profil/Modpack aus einem der Launcher. */
export interface McProfile {
  launcher: McLauncher
  name: string
  mcVersion: string | null // z. B. "1.21.1"
  modLoader: string | null // z. B. "fabric 0.18.4", "neoforge-21.1.216"
  modCount: number | null // Anzahl Mods (falls ermittelbar)
  lastPlayed: number | null // Unix-Sekunden
  playtimeSec: number | null // Spielzeit laut Launcher (falls vorhanden)
  iconUrl: string | null // data:-URL oder https
  instancePath: string // Ordner der Instanz (zum Öffnen im Explorer)
}

// --- Phase 4: World-of-Tanks-Mods ---

/** Eine verwaltete WoT-Mod (.wotmod-Datei). */
export interface WotMod {
  id: number
  fileName: string // z. B. "me.poliroid.pmod_1.81.05.wotmod"
  displayName: string // Dateiname ohne Endung
  enabled: boolean // soll aktiv sein (Wunsch-Zustand laut App)
  installed: boolean // liegt tatsächlich im aktuellen Versionsordner
  sizeBytes: number
}

/** Zustand des WoT-Mod-Managements. */
export interface WotStatus {
  ok: boolean
  wotDir: string | null // Spielordner (…\World of Tanks\eu)
  currentVersion: string | null // z. B. "2.3.0.1"
  mods: WotMod[]
  needsRestore: number // aktive Mods, die im aktuellen Versionsordner fehlen
  error?: string
}

/** Ein Eintrag der Update-Historie. */
export interface UpdateEvent {
  id: number
  gameId: number
  gameName: string
  type: 'erkannt' | 'installiert'
  oldBuild: string | null
  newBuild: string | null
  createdAt: number // Unix-Zeit (Sekunden)
}

// --- Phase 6: System / Treiber ---

export type DeviceCategory =
  | 'Grafikkarte'
  | 'Maus'
  | 'Tastatur'
  | 'Netzwerk'
  | 'Audio'
  | 'Speicher'
  | 'Bluetooth'
  | 'Prozessor'
  | 'Monitor'

/** Ein erkanntes Gerät mit seinem aktuell INSTALLIERTEN Treiber. */
export interface DeviceInfo {
  category: DeviceCategory
  name: string
  vendor: string
  driverVersion: string // kann leer sein (z. B. Maus/Tastatur/Speicher)
  driverDate: string | null // 'yyyy-MM-dd'
  isNvidiaGpu: boolean // nur für diese ist eine Update-Prüfung möglich
  storage?: { totalBytes: number; freeBytes: number } // nur Kategorie 'Speicher'
}

/** Ergebnis der Nvidia-Treiber-Update-Prüfung (nur für Nvidia-GPUs). */
export interface NvidiaUpdate {
  ok: boolean
  installedVersion: string | null // dekodiert, z. B. "596.49"
  latestVersion: string | null // z. B. "610.47"
  updateAvailable: boolean
  downloadUrl: string | null // offizieller NVIDIA-Download
  releaseDate: string | null
  error?: string
}

/** Ein aktuell laufendes Spiel (vom Wächter erkannt). */
export interface RunningGame {
  gameId: number
  startedAt: number // Unix-Zeit (Sekunden), seit wann es läuft
}

/** Ergebnis eines Steam-Scans. */
export interface ScanResult {
  ok: boolean
  steamPath: string | null
  libraries: string[]
  games: GameCard[]
  error?: string
}

// --- Konten: verbundene externe Konten (z. B. Epic) ---

/** Zustand der Epic-Konto-Verbindung. */
export interface EpicAccountStatus {
  connected: boolean
  displayName: string | null
}

/** Ergebnis des Epic-Spielzeit-Abgleichs. */
export interface EpicSyncResult {
  ok: boolean
  updatedGames: number // wie viele Spiele eine neue Spielzeit bekommen haben
  error?: string
}

// --- Shops: Plattform-Details & Angebote ---

/** Ein Gratisspiel aus dem Epic Store (aktuell oder angekündigt). */
export interface EpicFreeGame {
  title: string
  status: 'gratis' | 'demnaechst'
  startDate: number | null // Unix-Sekunden
  endDate: number | null
  originalPrice: string | null // formatiert, z. B. "17,99 €"
  coverUrl: string | null // Hochformat (für die Shop-Seite)
  wideCoverUrl: string | null // Querformat (für die Startseite)
  storeUrl: string | null
}

/** Ein Spiel aus der kompletten Epic-Bibliothek (auch nicht installiert). */
export interface EpicLibraryGame {
  title: string
  appName: string // Epics interne ID (== platformId installierter Spiele)
  installed: boolean
  playtimeSec: number // offizielle Epic-Spielzeit
  coverUrl: string | null
}

/** Ergebnis des Epic-Bibliotheks-Abrufs. */
export interface EpicLibraryResult {
  ok: boolean
  games: EpicLibraryGame[]
  error?: string
}

// --- Spiel-Detailseiten: Store-Infos, News & Erfolge ---

/** Store-Infos zu einem Spiel (aus der öffentlichen Steam-Store-API, auf Deutsch). */
export interface GameDetails {
  ok: boolean
  appId: number | null // zugeordnete Steam-AppID (auch für Nicht-Steam-Spiele per Namenssuche)
  shortDescription: string | null
  genres: string[] // z. B. ["Action", "Rollenspiel"]
  developers: string[]
  publishers: string[]
  releaseDate: string | null // bereits formatiert, z. B. "10. Okt. 2023"
  metacritic: number | null // Wertung 0–100 (falls vorhanden)
  screenshots: string[] // https-URLs in voller Größe
  storeUrl: string | null
  error?: string
}

/** Ein lokal gespeicherter, selbst aufgenommener Steam-Screenshot. */
export interface GameScreenshot {
  full: string // shot://-URL des Vollbilds
  thumb: string // shot://-URL der Vorschau
  takenAt: number // Aufnahmezeit (Unix-Sekunden, aus der Datei)
}

/** Eine News-/Patchnotes-Meldung zu einem Spiel. */
export interface GameNewsItem {
  title: string
  url: string
  date: number // Unix-Sekunden
  feedLabel: string // Quelle, z. B. "Community-Ankündigungen"
  excerpt: string // bereinigter Textanfang
}

/** Eine News-Meldung im gebündelten Bibliotheks-Feed (A7) — News + Spielbezug. */
export interface LibraryNewsItem {
  gameName: string
  appId: number
  coverUrl: string | null
  title: string
  url: string
  date: number // Unix-Sekunden
  feedLabel: string
  excerpt: string
}

/** Ergebnis des gebündelten News-Feeds über die ganze Bibliothek. */
export interface LibraryNewsResult {
  ok: boolean
  items: LibraryNewsItem[]
  scannedGames: number // wie viele Spiele für News abgefragt wurden
}

/** Ein einzelner Steam-Erfolg mit Freischalt-Zustand des Nutzers. */
export interface GameAchievement {
  name: string
  description: string
  iconUrl: string // farbig (freigeschaltet)
  iconGrayUrl: string // grau (gesperrt)
  achieved: boolean
  unlockTime: number | null // Unix-Sekunden
  globalPercent: number | null // wie viele Spieler weltweit ihn haben (0–100)
}

/** Ergebnis der Erfolgs-Abfrage für ein Spiel. */
export interface AchievementsResult {
  ok: boolean
  supported: boolean // false = Spiel hat keine Erfolge / kein Steam-Spiel
  keyMissing?: boolean // true = es ist kein Steam-Web-API-Key hinterlegt
  unlocked: number
  total: number
  list: GameAchievement[]
  error?: string
}

// --- Freunde (Stufe A: Steam-Freunde nur lesen) ---

/** Steam-Online-Status eines Freundes (vereinfacht aus personastate). */
export type FriendState = 'offline' | 'online' | 'away' | 'busy' | 'ingame'

/** Ein Steam-Freund mit öffentlich sichtbarem Status. */
export interface SteamFriend {
  steamId: string
  personaName: string
  avatarUrl: string | null // volle https-URL (kein Proxy nötig)
  state: FriendState
  currentGame: string | null // Name des gerade gespielten Spiels (state 'ingame')
  currentGameAppId: number | null
  profileUrl: string | null // Link zum Steam-Profil
  lastLogoff: number | null // zuletzt online (Unix-Sek.) — nur wenn nicht privat
  private: boolean // true = Profil privat -> Bibliothek/Spielzeit nicht abrufbar
}

/** Ergebnis des Freundeslisten-Abrufs. */
export interface SteamFriendsResult {
  ok: boolean
  friends: SteamFriend[]
  keyMissing: boolean // true = kein Steam-Web-API-Key hinterlegt
  listPrivate: boolean // true = die EIGENE Freundesliste ist privat (nicht abrufbar)
  error?: string
}

/** Ein Spiel aus der Bibliothek eines Freundes. */
export interface FriendGame {
  appId: number
  name: string
  playtimeSec: number
  lastPlayed: number | null // Unix-Sek. (nur wenn Steam es liefert)
  coverUrl: string | null
}

/** Ergebnis des Bibliotheks-Abrufs für einen Freund. */
export interface FriendGamesResult {
  ok: boolean
  games: FriendGame[]
  private: boolean // true = Spieldetails des Freundes sind privat
  error?: string
}

// --- Statistik / Dashboard (A1) ---

/** Ein meistgespieltes Spiel für die Statistik-Seite. */
export interface StatTopGame {
  name: string
  platform: Platform
  coverUrl: string | null
  playtimeSec: number
}

// --- Spotify (Musik-Widget) ---

/** Verbindungszustand des Spotify-Kontos. */
export interface SpotifyStatus {
  connected: boolean
  displayName: string | null
  configured: boolean // false = keine Client-ID hinterlegt (App nicht eingerichtet)
}

/** Aktueller Wiedergabe-Zustand von Spotify. */
export interface SpotifyState {
  ok: boolean
  connected: boolean // Konto verbunden?
  active: boolean // läuft gerade ein Gerät/Track?
  isPlaying: boolean
  track: string | null
  artists: string | null
  albumArt: string | null // Cover-URL
  trackUrl: string | null // Link zum Song (Spotify)
  isPremiumError?: boolean // Steuern erfordert Premium / aktives Gerät
  error?: string
}

/** Getrackte Spielzeit (Sek.) über verschiedene Zeiträume — fürs Startseiten-Widget. */
export interface PlaytimePeriods {
  d14: number
  d30: number
  d365: number
}

/** Aggregierte Spielzeit-Statistik (Dashboard). */
export interface PlayStatsResult {
  totalPlaytimeSec: number // gesamte bekannte Spielzeit (Steam-Startwert + getrackt)
  trackedPlaytimeSec: number // nur von buffd selbst getrackte Zeit
  trackingSince: number | null // erster getrackter Spielstart (Unix-Sek.)
  sessionsCount: number // Anzahl getrackter Sitzungen
  gamesTotal: number // installierte Spiele (ohne Launcher)
  gamesPlayed: number // davon mit Spielzeit > 0
  gamesNeverPlayed: number // installiert, aber nie gespielt
  todaySec: number // heute (ab lokaler Mitternacht)
  weekSec: number // letzte 7 Tage
  monthSec: number // letzte 30 Tage
  topGames: StatTopGame[] // meistgespielt (max 8)
  daily: { day: string; sec: number }[] // lückenloses Tagesraster für die Heatmap
  weekday: number[] // 7 Werte (Mo..So), Sekunden — nur getrackte Sitzungen
}

/** Ein Freund, der ein bestimmtes Spiel besitzt (für die Detailseite). */
export interface FriendOnGame {
  steamId: string
  personaName: string
  avatarUrl: string | null
  playtimeSec: number // 0 = besitzt es, aber (noch) nicht gespielt
}

/** Ergebnis: welche Freunde ein bestimmtes Spiel besitzen/gespielt haben. */
export interface FriendsForGameResult {
  ok: boolean
  friends: FriendOnGame[] // nach Spielzeit absteigend
  keyMissing: boolean // kein Steam-Web-API-Key hinterlegt
}

/** Zustand des hinterlegten Steam-Web-API-Keys. */
export interface SteamKeyStatus {
  connected: boolean
  personaName: string | null // Steam-Profilname (lokal aus loginusers.vdf gelesen)
  steamId: string | null // SteamID64
}

/** Zustand des hinterlegten SteamGridDB-Keys. */
export interface SgdbStatus {
  connected: boolean
  builtin?: boolean // true = nutzt den eingebauten Standard-Key (kein eigener nötig)
}

// --- Wunschliste & Preise ---

/** Aus welchem Shop ein Wunschlisten-Eintrag stammt. */
export type WishlistShop = 'steam' | 'epic'

/** Ein Spiel auf der Wunschliste (mit zuletzt geprüftem Preis). */
export interface WishlistItem {
  id: number
  appId: string // Steam-AppID bzw. Epic "namespace:offerId"
  shop: WishlistShop
  name: string
  coverUrl: string | null
  storeUrl: string | null // direkte Store-Seite
  priceCents: number | null // aktueller Preis (null = unbekannt/gratis)
  originalCents: number | null // Preis ohne Rabatt
  discountPct: number // 0 = kein Rabatt -> keine Benachrichtigung
  checkedAt: number | null // letzte Preisprüfung (Unix-Sekunden)
}

/** Ein Suchtreffer aus dem Steam-Store (zum Hinzufügen zur Wunschliste). */
export interface SteamSearchResult {
  appId: string
  name: string
  coverUrl: string | null
  priceCents: number | null // aktueller Preis (null = gratis/unbekannt)
  originalCents: number | null
  discountPct: number
  storeUrl: string
}

/** Ein Suchtreffer aus dem Epic Store. */
export interface EpicSearchResult {
  id: string // "namespace:offerId" (eindeutig, == WishlistItem.appId)
  name: string
  coverUrl: string | null
  priceCents: number | null
  originalCents: number | null
  discountPct: number
  storeUrl: string | null
}

/** Preis-Infos zu einem Spiel (Steam aktuell + IsThereAnyDeal-Vergleich). */
export interface GamePriceInfo {
  ok: boolean
  appId: number | null
  /** Aktueller Steam-Preis (null = gratis oder nicht im Verkauf). */
  steam: {
    priceCents: number
    originalCents: number
    discountPct: number
  } | null
  /** Bester aktueller Preis über alle Shops (IsThereAnyDeal, braucht Key). */
  best: { shop: string; priceCents: number; cut: number; url: string } | null
  /** Historischer Tiefstpreis (IsThereAnyDeal, braucht Key). */
  historyLowCents: number | null
  itadKeyMissing: boolean
  error?: string
}

/** Zustand des hinterlegten IsThereAnyDeal-Keys. */
export interface ItadStatus {
  connected: boolean
  builtin?: boolean // true = nutzt den eingebauten Standard-Key (kein eigener nötig)
}

/** Ein Steam-Angebot (aktueller Sale). */
export interface SteamOffer {
  appId: number
  name: string
  discountPercent: number
  originalPriceCents: number | null
  finalPriceCents: number | null
  currency: string
  coverUrl: string | null // breites Header-Bild
  storeUrl: string
}

import { app, shell, BrowserWindow, ipcMain, protocol, net, screen } from 'electron'
import { dirname, join } from 'path'
import { existsSync, rmSync, renameSync } from 'fs'
import { spawn } from 'child_process'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import {
  initDatabase,
  closeDatabase,
  getDatabase,
  getLauncherTarget,
  listGames,
  getCoverPath,
  getLaunchInfo,
  listUpdateEvents,
  setImportedPlaytime,
  listCollections,
  createCollection,
  renameCollection,
  deleteCollection,
  setGameCollections
} from './db'
import type { GameRef } from '@shared/types'
import { scanLibrary } from './services/library'
import { listNotInstalledGames } from './services/notinstalled'
import { ensureGameTags } from './services/tags'
import { startTracker, stopTracker, flushActiveSessions, closeGame } from './services/tracker'
import { readDevices } from './services/system/drivers'
import { setDeviceName } from './services/system/deviceNames'
import { checkNvidiaUpdate } from './services/system/nvidia'
import { addWotMods, getWotStatus, openWotModsFolder, toggleWotMod } from './services/wot'
import { listMcProfiles } from './services/minecraft'
import { listMcServerStatus } from './services/minecraft/serverPing'
import {
  EPIC_LOGIN_URL,
  epicAccountStatus,
  epicLoginWithCode,
  epicLogout,
  syncEpicPlaytime
} from './services/epic/account'
import { getEpicFreeGames } from './services/epic/store'
import { searchEpicStore, getEpicOffers } from './services/epic/search'
import { getEpicLibrary } from './services/epic/library'
import { getSteamOffers } from './services/steam/offers'
import { getGameDetails, getGameNews, getGamePrices } from './services/gamedetails'
import {
  checkOneWishlistPrice,
  checkWishlistPrices,
  importSteamWishlist,
  searchSteamStore
} from './services/wishlist'
import { itadStatus, setItadKey, clearItadKey } from './services/itad'
import { addWishlistItem, listWishlist, removeWishlistItem } from './db'
import { getGameAchievements } from './services/steam/achievements'
import { steamKeyStatus, setSteamApiKey, clearSteamApiKey } from './services/steam/webapi'
import { getSteamFriends, getFriendGames, getFriendsForGame } from './services/steam/friends'
import {
  listSteamScreenshots,
  isAllowedShot,
  decodeShotPath,
  copyScreenshot,
  revealScreenshot,
  deleteScreenshot
} from './services/steam/screenshots'
import { getPlayStats, getPlaytimePeriods } from './services/stats'
import { getLibraryNews } from './services/news'
import {
  spotifyStatus,
  setSpotifyClientId,
  spotifyLogin,
  spotifyLogout,
  spotifyGetState,
  spotifyControl,
  type SpotifyAction
} from './services/spotify'
import { sgdbStatus, setSgdbKey, clearSgdbKey, upgradeWikiCovers, gameHero } from './services/sgdb'
import { COVER_PLATFORMS } from './services/covers'
import { analyzeGameStorage, computeGameSize, listGameStorage } from './services/storage'
import {
  sendFeedback,
  feedbackAvailable,
  type FeedbackKind,
  type FeedbackAttachment
} from './services/feedback'

// Referenz aufs Hauptfenster, damit der Wächter Live-Updates schicken kann.
let mainWindow: BrowserWindow | null = null
// Merkt sich eine fertig heruntergeladene Update-Version. Falls der Download
// abgeschlossen ist, BEVOR das Fenster/der Renderer bereit ist, kann der
// Renderer den Stand beim Start trotzdem über „app:update-status" abfragen.
let pendingUpdateVersion: string | null = null
// Zeitpunkt (ms) der letzten erfolgreichen Update-Prüfung (Start, 6-h-Takt, manuell).
let lastUpdateCheckAt: number | null = null
// Ergebnis der ERSTEN Update-Prüfung beim Start — der Ladescreen wartet darauf.
// null = ungepackt/kein Updater (Ladescreen läuft dann sofort weiter).
let startupUpdateCheck: Promise<{ updateAvailable: boolean; version?: string }> | null = null

// Datenordner: früher %APPDATA%\spiele-hub (interner Altname), seit dem Rebrand
// %APPDATA%\buffd. Beim ersten Start der umbenannten Version wird der alte Ordner
// EINMALIG komplett übernommen (DB, WAL/SHM, Einstellungen) — Spielzeit/Statistik
// bleiben also erhalten. Die appId (com.spielehub.app) und damit der Update-Kanal
// bleiben bewusst unberührt; nur der sichtbare Ordnername wandert auf „buffd".
// Echte, vom NSIS-Installer eingerichtete Installation? Nur dann den (einmaligen,
// einwegigen) Umzug spiele-hub -> buffd durchführen. Test-Builds (release\win-unpacked
// via --dir) und der Dev-Modus teilen sich die Daten weiterhin am Altort und benennen
// NICHTS um — sonst würde die installierte Release-Version ihren Datenordner „verlieren".
function isRealInstall(): boolean {
  if (!app.isPackaged) return false
  return existsSync(join(dirname(app.getPath('exe')), 'Uninstall buffd.exe'))
}

function resolveUserDataDir(): string {
  const appData = app.getPath('appData')
  const newDir = join(appData, 'buffd')
  const oldDir = join(appData, 'spiele-hub')
  if (existsSync(newDir)) return newDir // bereits migriert oder Neuinstallation
  if (existsSync(oldDir)) {
    if (!isRealInstall()) return oldDir // Test/Dev: Altordner in Ruhe lassen
    try {
      renameSync(oldDir, newDir) // atomarer Umzug auf demselben Laufwerk
      return newDir
    } catch {
      // Ordner evtl. noch gesperrt (alte Version läuft parallel) — diesmal den
      // alten Ordner weiternutzen; der nächste saubere Start migriert erneut.
      return oldDir
    }
  }
  return newDir // frische Installation: gleich unter „buffd" anlegen
}
app.setPath('userData', resolveUserDataDir())

// Nur eine Instanz zulassen: Dev-Modus und installierte App teilen sich die
// Datenbank; zwei gleichzeitige Wächter würden doppelte Sitzungen schreiben.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

// Das cover://-Schema MUSS registriert werden, BEVOR die App bereit ist.
// "secure/standard" sorgt dafür, dass es wie https behandelt wird und in <img> erlaubt ist.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'cover',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  },
  {
    // Liefert lokale, selbst aufgenommene Steam-Screenshots aus (siehe screenshots.ts).
    scheme: 'shot',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

function createWindow(): void {
  // Beim Start ein großzügiges Fenster — 90 % der nutzbaren Bildschirmfläche,
  // aber gedeckelt, damit es auf großen Monitoren nicht riesig wird.
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize
  const startWidth = Math.min(1700, Math.round(screenW * 0.9))
  const startHeight = Math.min(1040, Math.round(screenH * 0.9))

  const win = new BrowserWindow({
    width: startWidth,
    height: startHeight,
    minWidth: 940,
    minHeight: 600,
    center: true,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  mainWindow = win

  win.on('ready-to-show', () => win.show())
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Auto-Update: beim Start (und danach alle 6 h) auf GitHub nach einer neueren
// Version schauen. Gefundene Updates werden STILL heruntergeladen; installiert
// wird erst, wenn der Nutzer in der App auf "Neu starten" klickt (oder beim
// nächsten normalen Beenden). Im Dev-Modus gibt es nichts zu updaten.
function setupAutoUpdater(): void {
  if (!app.isPackaged) return
  autoUpdater.autoDownload = true
  autoUpdater.on('update-downloaded', (info) => {
    pendingUpdateVersion = info.version
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app:update-ready', info.version)
    }
  })
  autoUpdater.on('error', () => {}) // offline o. ä. — still ignorieren
  // Eine erfolgreich abgeschlossene Prüfung (egal ob Update da oder nicht) merken.
  autoUpdater.on('update-available', () => {
    lastUpdateCheckAt = Date.now()
  })
  autoUpdater.on('update-not-available', () => {
    lastUpdateCheckAt = Date.now()
  })
  const check = (): Promise<{ updateAvailable: boolean; version?: string }> =>
    autoUpdater
      .checkForUpdates()
      .then((r) => {
        lastUpdateCheckAt = Date.now()
        const version = r?.updateInfo?.version
        return { updateAvailable: !!version && version !== app.getVersion(), version }
      })
      .catch(() => ({ updateAvailable: false }))
  // Erste Prüfung beim Start merken — der Ladescreen wartet auf genau diese.
  startupUpdateCheck = check()
  setInterval(() => void check(), 6 * 60 * 60 * 1000)
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.spielehub.app')

  // GANZ ZUERST den Update-Check anstoßen (Netzwerk läuft dann parallel zum
  // restlichen Start), damit ein gefundenes Update so früh wie möglich bereit
  // steht. Hängt weder von der Datenbank noch vom Fenster ab.
  setupAutoUpdater()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 1) Datenbank hochfahren.
  initDatabase()

  // 2) cover://<platform>/<platformId> -> liefert das lokale Cover-Bild aus.
  //    Der Renderer kann so <img src="cover://steam/440"> nutzen, ohne direkten
  //    Dateisystem-Zugriff zu haben.
  protocol.handle('cover', async (request) => {
    const url = new URL(request.url)
    const platform = url.hostname
    const platformId = decodeURIComponent(url.pathname.replace(/^\//, ''))
    const filePath = getCoverPath(platform, platformId)
    if (filePath && existsSync(filePath)) {
      return net.fetch(pathToFileURL(filePath).toString())
    }
    return new Response('Cover nicht gefunden', { status: 404 })
  })

  // 2b) shot://file/<base64url-pfad> -> liefert einen lokalen Screenshot aus.
  //     Es werden NUR Pfade ausgeliefert, die zuvor über screenshots:list als
  //     gültige Steam-Screenshots aufgelistet wurden (kein freier Dateizugriff).
  protocol.handle('shot', async (request) => {
    const url = new URL(request.url)
    const encoded = decodeURIComponent(url.pathname.replace(/^\//, ''))
    const filePath = decodeShotPath(encoded)
    if (filePath && isAllowedShot(filePath) && existsSync(filePath)) {
      return net.fetch(pathToFileURL(filePath).toString())
    }
    return new Response('Screenshot nicht gefunden', { status: 404 })
  })

  // 3) IPC-Endpunkte für den Renderer.
  ipcMain.handle('app:db-status', () => {
    const db = getDatabase()
    const row = db.prepare('SELECT COUNT(*) AS count FROM games').get() as { count: number }
    return { ok: true, gameCount: row.count, dbPath: db.name }
  })

  // App-Version anzeigen + heruntergeladenes Update auf Klick installieren.
  ipcMain.handle('app:version', () => app.getVersion())
  // Update installieren: still (isSilent) + danach neu starten (isForceRunAfter).
  // „still" ist seit dem Wechsel auf den geführten NSIS-Installer (oneClick:false)
  // nötig, sonst würde bei JEDEM Update der Installer-Assistent aufpoppen.
  ipcMain.handle('app:install-update', () => autoUpdater.quitAndInstall(true, true))

  // Wo liegt buffd (Programm) und wo die eigenen Daten (Spielzeit/Einstellungen)?
  ipcMain.handle('app:install-info', () => ({
    installDir: dirname(app.getPath('exe')),
    dataDir: app.getPath('userData')
  }))
  ipcMain.handle('app:open-install-dir', () => shell.openPath(dirname(app.getPath('exe'))))
  ipcMain.handle('app:open-data-dir', () => shell.openPath(app.getPath('userData')))
  // Beim Start abfragen, ob schon ein Update fertig heruntergeladen ist (falls
  // der Download schneller war als der Renderer-Listener).
  ipcMain.handle('app:update-status', () => pendingUpdateVersion)
  // Zeitpunkt (ms) der letzten erfolgreichen Update-Prüfung (oder null).
  ipcMain.handle('app:last-update-check', () => lastUpdateCheckAt)
  // Der Ladescreen wartet auf die ERSTE Update-Prüfung beim Start. Löst auf,
  // sobald die Prüfung durch ist — oder sofort, wenn ungepackt/kein Updater.
  ipcMain.handle('app:startup-check', () => startupUpdateCheck ?? { updateAvailable: false })

  // Feedback / Bug-Report: an den Discord-Webhook senden + ob konfiguriert.
  ipcMain.handle('feedback:available', () => feedbackAvailable())
  ipcMain.handle(
    'feedback:send',
    (_e, args: { kind: FeedbackKind; message: string; attachment?: FeedbackAttachment }) =>
      sendFeedback(args.kind, args.message, args.attachment)
  )

  // Manuell sofort auf App-Updates prüfen (z. B. „Aktualisieren" in der Glocke).
  // Bei Fund lädt electron-updater im Hintergrund; der „update-downloaded"-Handler
  // meldet sich dann von selbst. Wir warten hier NICHT auf den Download.
  ipcMain.handle('app:check-updates', async () => {
    if (!app.isPackaged) return { ok: false, reason: 'dev' as const }
    try {
      const result = await autoUpdater.checkForUpdates()
      const version = result?.updateInfo?.version
      const updateAvailable = !!version && version !== app.getVersion()
      lastUpdateCheckAt = Date.now()
      return { ok: true as const, updateAvailable, version, checkedAt: lastUpdateCheckAt }
    } catch (err) {
      const msg = String(err instanceof Error ? err.message : err)
      // Im Testbuild (--dir, ohne Installer) fehlt app-update.yml -> kein Updater.
      if (msg.includes('app-update.yml')) return { ok: false as const, reason: 'noconfig' as const }
      return { ok: false as const, reason: 'error' as const }
    }
  })

  // buffd selbst deinstallieren: den von NSIS angelegten Uninstaller starten und
  // die App beenden (er entfernt den Rest). Im Experimentier-/Dev-Build (kein
  // Installer) gibt es keinen Uninstaller -> dem Renderer Bescheid geben.
  // Optional (deleteData): vorher die eigenen Nutzerdaten löschen — die SQLite-DB
  // (Spielzeit/Statistik/Einstellungen) in userData sowie den Update-Cache.
  ipcMain.handle('app:uninstall', (_e, opts?: { deleteData?: boolean }) => {
    const uninstaller = join(dirname(app.getPath('exe')), 'Uninstall buffd.exe')
    if (!app.isPackaged || !existsSync(uninstaller)) {
      return { ok: false, reason: 'experimental' as const }
    }
    if (opts?.deleteData === true) {
      // DB schließen (Datei freigeben) und Fenster zerstören (gibt die vom
      // Renderer gehaltenen Sperren wie localStorage frei), dann Ordner löschen.
      closeDatabase()
      stopTracker()
      for (const w of BrowserWindow.getAllWindows()) w.destroy()
      const userData = app.getPath('userData') // …\Roaming\buffd
      const localAppData = join(app.getPath('appData'), '..', 'Local')
      const updaterCache = join(localAppData, 'buffd-updater')
      const legacyUpdaterCache = join(localAppData, 'spiele-hub-updater') // Altbestand
      for (const dir of [userData, updaterCache, legacyUpdaterCache]) {
        try {
          rmSync(dir, { recursive: true, force: true })
        } catch {
          /* einzelne noch gesperrte Dateien ignorieren — bestmöglich aufräumen */
        }
      }
    }
    spawn(uninstaller, [], { detached: true, stdio: 'ignore' }).unref()
    setTimeout(() => app.quit(), 1000) // Dateien freigeben, damit der Uninstaller löschen kann
    return { ok: true as const }
  })

  // Experimenteller (Test-)Build? Eine echte, vom NSIS-Installer eingerichtete
  // Installation hat IMMER den Uninstaller „Uninstall buffd.exe" daneben liegen.
  // Test-Builds (release\win-unpacked\ via --dir) und der Dev-Modus haben ihn nicht.
  // Das ist robuster als ein fester Pfad — der Nutzer darf den Installordner jetzt
  // frei wählen (oneClick:false), ein Ordnervergleich würde sonst danebenliegen.
  ipcMain.handle('app:experimental', () => {
    if (!app.isPackaged) return true
    const uninstaller = join(dirname(app.getPath('exe')), 'Uninstall buffd.exe')
    return !existsSync(uninstaller)
  })

  ipcMain.handle('library:scan', () => scanLibrary())
  ipcMain.handle('games:list', () => listGames())
  ipcMain.handle('games:not-installed', () => listNotInstalledGames())

  // Eigene Sammlungen/Kategorien (B3).
  ipcMain.handle('collections:list', () => listCollections())
  ipcMain.handle('collections:create', (_e, name: string) => createCollection(name))
  ipcMain.handle('collections:rename', (_e, args: { id: number; name: string }) => {
    renameCollection(args.id, args.name)
    return listCollections()
  })
  ipcMain.handle('collections:delete', (_e, id: number) => {
    deleteCollection(id)
    return listCollections()
  })
  // Sammlungs-Zuordnung eines Spiels setzen -> frische Spiel- und Sammlungslisten zurück.
  ipcMain.handle(
    'collections:set-for-game',
    (_e, args: { gameId: number; collectionIds: number[] }) => {
      setGameCollections(args.gameId, args.collectionIds)
      return { games: listGames(), collections: listCollections() }
    }
  )
  ipcMain.handle('games:ensure-tags', async () => {
    const n = await ensureGameTags()
    if (n > 0 && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('games:refresh') // Tags nachgeladen -> Liste auffrischen
    }
    return n
  })

  // Starten: je nach Eintrag eine URL (Steam/Epic) im jeweiligen Client öffnen
  // oder eine exe direkt starten (Launcher). Die Zeitmessung macht der Wächter.
  // Ein Start-Ziel ausführen: spawn:-JSON (exe + Argumente), URL oder exe-Pfad.
  const executeLaunchTarget = (target: string | null): boolean => {
    if (!target) return false
    if (target.startsWith('spawn:')) {
      // Programm mit Argumenten starten (z. B. Battle.net --exec="launch WTCG").
      try {
        const { exe, args } = JSON.parse(target.slice(6)) as { exe: string; args?: string[] }
        spawn(exe, args ?? [], { detached: true, stdio: 'ignore' }).unref()
        return true
      } catch {
        return false
      }
    }
    if (target.includes('://')) {
      shell.openExternal(target) // steam:// oder com.epicgames.launcher://
    } else {
      shell.openPath(target) // exe-Pfad (Launcher)
    }
    return true
  }

  ipcMain.handle('game:launch', (_e, id: number) => {
    const info = getLaunchInfo(id)
    if (!info) return { ok: false }
    const ok = info.launchTarget
      ? executeLaunchTarget(info.launchTarget)
      : executeLaunchTarget(`steam://rungameid/${info.platformId}`) // Rückfall
    return { ok }
  })

  // Den Launcher einer Plattform öffnen (z. B. Battle.net fürs Spiel-Update).
  ipcMain.handle('platform:open-launcher', (_e, platform: string) =>
    executeLaunchTarget(getLauncherTarget(platform))
  )

  // Spiel schließen: alle Prozesse im Installationsordner beenden.
  ipcMain.handle('game:close', (_e, gameId: number) => closeGame(gameId))

  // Phase 3: Update-Historie (alle Spiele oder ein einzelnes).
  ipcMain.handle('updates:history', (_e, gameId?: number) => listUpdateEvents(gameId))

  // Spielzeit-Startwert manuell setzen (für Epic-Spiele, deren Zeit nur online liegt).
  ipcMain.handle('game:set-playtime', (_e, args: { gameId: number; seconds: number }) => {
    setImportedPlaytime(args.gameId, args.seconds)
    return listGames()
  })

  // Phase 3: alle 10 Minuten still neu scannen, damit neue Updates ohne
  // manuelles Aktualisieren erkannt werden. Renderer wird benachrichtigt.
  setInterval(
    () => {
      scanLibrary()
        .then(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('games:refresh')
          }
        })
        .catch(() => {})
    },
    10 * 60 * 1000
  )

  // Phase 5: Minecraft-Profile/Modpacks (nur lesend).
  ipcMain.handle('mc:profiles', () => listMcProfiles())
  ipcMain.handle('mc:open-folder', (_e, path: string) => {
    if (existsSync(path)) shell.openPath(path)
  })
  // Stufe 1: Minecraft-Server per Server List Ping abfragen (kein API-Key).
  ipcMain.handle('mc:servers', () => listMcServerStatus())

  // Phase 4: World-of-Tanks-Mod-Management.
  ipcMain.handle('wot:status', () => getWotStatus())
  ipcMain.handle('wot:toggle', (_e, args: { id: number; enable: boolean }) =>
    toggleWotMod(args.id, args.enable)
  )
  ipcMain.handle('wot:add', () => addWotMods())
  ipcMain.handle('wot:open-folder', () => openWotModsFolder())

  // Konten: Epic-Konto verbinden, Status, Spielzeit-Abgleich.
  ipcMain.handle('epic:status', () => epicAccountStatus())
  ipcMain.handle('epic:open-login', () => shell.openExternal(EPIC_LOGIN_URL))
  ipcMain.handle('epic:login', async (_e, code: string) => {
    try {
      return { ok: true as const, status: await epicLoginWithCode(code) }
    } catch (err) {
      return { ok: false as const, error: String(err instanceof Error ? err.message : err) }
    }
  })
  ipcMain.handle('epic:logout', () => {
    epicLogout()
    return epicAccountStatus()
  })
  ipcMain.handle('epic:sync-playtime', async () => {
    const result = await syncEpicPlaytime()
    if (result.ok && result.updatedGames > 0 && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('games:refresh')
    }
    return result
  })

  // Shops: Epic-Gratisspiele (ohne Login), komplette Epic-Bibliothek
  // (mit Konto) und aktuelle Steam-Angebote (ohne Login).
  ipcMain.handle('epic:free-games', () => getEpicFreeGames())
  ipcMain.handle('epic:offers', () => getEpicOffers())
  ipcMain.handle('epic:library', () => getEpicLibrary())
  ipcMain.handle('steam:offers', () => getSteamOffers())

  // Spiel-Detailseiten: Store-Infos, News/Patchnotes und Erfolge.
  ipcMain.handle('game:details', (_e, ref: GameRef) => getGameDetails(ref))
  ipcMain.handle('game:news', (_e, ref: GameRef) => getGameNews(ref))
  ipcMain.handle('game:achievements', (_e, ref: GameRef) => getGameAchievements(ref))
  // Lokale, selbst aufgenommene Screenshots — nur für Steam-Spiele (platformId = AppID).
  ipcMain.handle('game:screenshots', (_e, ref: GameRef) =>
    ref.platform === 'steam' ? listSteamScreenshots(ref.platformId) : []
  )
  // Screenshot verwalten: in die Zwischenablage kopieren, im Explorer zeigen, löschen.
  ipcMain.handle('screenshot:copy', (_e, url: string) => copyScreenshot(url))
  ipcMain.handle('screenshot:reveal', (_e, url: string) => revealScreenshot(url))
  ipcMain.handle('screenshot:delete', (_e, url: string) => deleteScreenshot(url))

  // Freunde (Stufe A): Steam-Freundesliste + Bibliothek eines Freundes (read-only).
  ipcMain.handle('friends:list', () => getSteamFriends())
  ipcMain.handle('friends:games', (_e, steamId: string) => getFriendGames(steamId))
  ipcMain.handle('friends:for-game', (_e, appId: number) => getFriendsForGame(appId))

  // Statistik / Dashboard (A1): Spielzeit-Auswertung aus den getrackten Sitzungen.
  ipcMain.handle('stats:play', () => getPlayStats())
  ipcMain.handle('stats:periods', () => getPlaytimePeriods())

  // News-Feed (A7): neueste News/Patchnotes aller Steam-Spiele gebündelt.
  ipcMain.handle('news:library', (_e, force?: boolean) => getLibraryNews(force === true))

  // Spotify-Musik-Widget: Verbindung, Wiedergabe-Status und Steuerung.
  ipcMain.handle('spotify:status', () => spotifyStatus())
  ipcMain.handle('spotify:set-client', (_e, id: string | null) => setSpotifyClientId(id))
  ipcMain.handle('spotify:login', () => spotifyLogin())
  ipcMain.handle('spotify:logout', () => spotifyLogout())
  ipcMain.handle('spotify:state', () => spotifyGetState())
  ipcMain.handle('spotify:control', (_e, action: SpotifyAction) => spotifyControl(action))

  // Installationsordner eines Spiels im Datei-Explorer öffnen.
  ipcMain.handle('game:open-folder', (_e, path: string) => {
    if (path && existsSync(path)) shell.openPath(path)
    return existsSync(path)
  })

  // Steam-Web-API-Key (für Erfolge) verwalten.
  ipcMain.handle('steamkey:status', () => steamKeyStatus())
  ipcMain.handle('steamkey:set', (_e, key: string) => setSteamApiKey(key))
  ipcMain.handle('steamkey:clear', () => clearSteamApiKey())

  // SteamGridDB-Key (für bessere Cover) verwalten. Nach dem Hinterlegen werden
  // vorhandene Wikipedia-Logo-Cover direkt durch echte Box-Art ersetzt.
  ipcMain.handle('sgdb:status', () => sgdbStatus())
  ipcMain.handle('sgdb:set', async (_e, key: string) => {
    const result = await setSgdbKey(key)
    if (!result.ok) return result
    const upgraded = await upgradeWikiCovers(COVER_PLATFORMS)
    if (upgraded > 0 && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('games:refresh')
    }
    return { ok: true as const, upgradedCovers: upgraded }
  })
  ipcMain.handle('sgdb:clear', () => clearSgdbKey())
  // Querformat-„Hero"-Banner für ein einzelnes Spiel (Library-Spotlight/Karten).
  ipcMain.handle(
    'sgdb:hero',
    (_e, ref: { platform: string; platformId: string; name: string }) =>
      gameHero(ref.platform, ref.platformId, ref.name)
  )

  // Wunschliste mit Preisalarm + Steam-Store-Suche + Preis-Infos.
  ipcMain.handle('wishlist:list', () => listWishlist())
  ipcMain.handle(
    'wishlist:add',
    async (
      _e,
      item: {
        appId: string
        name: string
        coverUrl: string | null
        shop?: 'steam' | 'epic'
        storeUrl?: string | null
      }
    ) => {
      addWishlistItem(item.appId, item.name, item.coverUrl, item.shop ?? 'steam', item.storeUrl ?? null)
      return checkOneWishlistPrice(item.appId) // nur den neuen Eintrag prüfen (schnell)
    }
  )
  ipcMain.handle('wishlist:remove', (_e, appId: string) => {
    removeWishlistItem(appId)
    return listWishlist()
  })
  ipcMain.handle('wishlist:check', () => checkWishlistPrices())
  ipcMain.handle('wishlist:import-steam', async () => {
    const result = await importSteamWishlist()
    if (result.ok && result.imported > 0 && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('wishlist:refresh') // Glocke aktualisieren
    }
    return result
  })
  ipcMain.handle('steam:search', (_e, term: string) => searchSteamStore(term))
  ipcMain.handle('epic:search', (_e, term: string) => searchEpicStore(term))
  ipcMain.handle('game:prices', (_e, ref: GameRef) => getGamePrices(ref))

  // IsThereAnyDeal-Key (Preisvergleich/Tiefstpreise) verwalten.
  ipcMain.handle('itad:status', () => itadStatus())
  ipcMain.handle('itad:set', (_e, key: string) => setItadKey(key))
  ipcMain.handle('itad:clear', () => clearItadKey())

  // Preise beim Start und danach alle 6 h prüfen; die Glocke lädt dann neu.
  const checkPrices = (): void => {
    checkWishlistPrices()
      .then(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('wishlist:refresh')
        }
      })
      .catch(() => {})
  }
  checkPrices()
  setInterval(checkPrices, 6 * 60 * 60 * 1000)

  // Speicherplatz-Analyse: gecachter Stand, komplette Neuberechnung
  // (mit Live-Fortschritt pro Spiel) und Einzelberechnung für die Detailseite.
  ipcMain.handle('storage:list', () => listGameStorage())
  ipcMain.handle('storage:analyze', () =>
    analyzeGameStorage((info) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('storage:progress', info)
      }
    })
  )
  ipcMain.handle('storage:game', (_e, gameId: number) => computeGameSize(gameId))

  // Beim Start (falls verbunden) die Epic-Spielzeiten still abgleichen.
  if (epicAccountStatus().connected) {
    syncEpicPlaytime()
      .then((r) => {
        if (r.ok && r.updatedGames > 0 && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('games:refresh')
        }
      })
      .catch(() => {})
  }

  // Phase 6: installierte Geräte + Treiberversionen auslesen.
  ipcMain.handle('system:devices', () => readDevices())

  // Eigenen Gerätenamen setzen/zurücksetzen (name = null -> Original).
  ipcMain.handle('system:rename-device', (_e, args: { id: string; name: string | null }) => {
    setDeviceName(args.id, args.name)
  })

  // Phase 6: Update-Prüfung für eine Nvidia-GPU (nur Anzeige, kein Installieren).
  ipcMain.handle('nvidia:check', (_e, args: { name: string; driverVersion: string }) =>
    checkNvidiaUpdate(args.name, args.driverVersion)
  )

  // Phase 6: die NVIDIA App öffnen (dort macht der Nutzer das Update selbst).
  ipcMain.handle('nvidia:open-app', () => {
    const candidates = [
      'C:\\Program Files\\NVIDIA Corporation\\NVIDIA App\\CEF\\NVIDIA App.exe',
      'C:\\Program Files\\NVIDIA Corporation\\NVIDIA App\\NVIDIA App.exe',
      'C:\\Program Files (x86)\\NVIDIA Corporation\\NVIDIA App\\CEF\\NVIDIA App.exe'
    ]
    const exe = candidates.find((c) => existsSync(c))
    if (exe) {
      shell.openPath(exe)
      return true
    }
    return false
  })

  // 4) Hintergrund-Wächter starten. Er schickt Live-Updates ans Fenster.
  startTracker((channel, payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, payload)
    }
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Beim Beenden laufende Sitzungen sauber abschließen, damit die gerade gespielte
// Zeit nicht verloren geht (sonst bliebe die Sitzung ohne Ende -> Dauer 0).
app.on('before-quit', () => {
  stopTracker()
  try {
    flushActiveSessions() // schlägt fehl, wenn die DB beim Deinstallieren schon geschlossen wurde
  } catch {
    /* DB bereits geschlossen (z. B. „Daten löschen" beim Deinstallieren) */
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

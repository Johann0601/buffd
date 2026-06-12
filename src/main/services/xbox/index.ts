// Xbox-App-Spiele (Game Pass / Microsoft Store): liegen unter
// <Laufwerk>:\XboxGames\<Spiel>\Content mit einer MicrosoftGame.config,
// die alles Wichtige enthält (Name, exe fürs Tracking, Logo).
// Gestartet wird UWP-typisch über shell:AppsFolder\<PFN>!<AppId> — die
// Zuordnung liefert EIN gebündelter PowerShell-Aufruf (Get-AppxPackage),
// dessen Ergebnis pro Sitzung gemerkt wird.

import { execFileSync } from 'child_process'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { upsertGame } from '../../db'

interface XboxGame {
  identityName: string // z. B. "ROBLOXCorporation.RobloxGDK" (= platformId)
  displayName: string
  contentDir: string
  exeNames: string[] // aus der ExecutableList (fürs Spielzeit-Tracking)
  logoPath: string | null // absoluter Pfad zum lokalen Logo-PNG
}

interface PackageInfo {
  pfn: string // PackageFamilyName
  appId: string // Application-Id aus dem Manifest
}

// Pro Sitzung gemerkt: Identity-Name -> Paket-Info (ändert sich praktisch nie).
const packageCache = new Map<string, PackageInfo | null>()
// Installationsordner der Xbox-App selbst (für deren Logo).
let gamingAppLocation: string | null | undefined

/** Alle XboxGames-Ordner über alle Laufwerke finden. */
function xboxGameRoots(): string[] {
  const roots: string[] = []
  for (let c = 65; c <= 90; c++) {
    const drive = `${String.fromCharCode(c)}:\\`
    const candidates = new Set<string>([join(drive, 'XboxGames')])
    // .GamingRoot nennt den (umbenennbaren) Spieleordner: "RGBX" + UTF-16-Pfad.
    try {
      const raw = readFileSync(join(drive, '.GamingRoot'))
      const text = raw.subarray(8).toString('utf16le').replace(/\0+$/, '').trim()
      if (text) candidates.add(join(drive, text))
    } catch {
      /* kein .GamingRoot auf diesem Laufwerk */
    }
    for (const dir of candidates) {
      try {
        if (existsSync(dir)) roots.push(dir)
      } catch {
        /* Laufwerk nicht lesbar */
      }
    }
  }
  return roots
}

/** Eine MicrosoftGame.config grob auslesen (Regex reicht — feste Struktur). */
function parseGameConfig(contentDir: string): XboxGame | null {
  const configPath = ['MicrosoftGame.config', 'MicrosoftGame.Config']
    .map((n) => join(contentDir, n))
    .find((p) => existsSync(p))
  if (!configPath) return null
  try {
    const xml = readFileSync(configPath, 'utf8')
    const identity = /Identity\s+Name="([^"]+)"/i.exec(xml)?.[1]
    const display = /DefaultDisplayName="([^"]+)"/i.exec(xml)?.[1]
    if (!identity || !display) return null

    const exeNames: string[] = []
    for (const m of xml.matchAll(/Executable\s+Name="([^"]+\.exe)"/gi)) {
      exeNames.push(m[1].toLowerCase())
    }

    // Größtes verfügbares Logo als Cover nehmen.
    let logoPath: string | null = null
    for (const key of ['Square480x480Logo', 'Square150x150Logo', 'Square44x44Logo']) {
      const rel = new RegExp(`${key}="([^"]+)"`, 'i').exec(xml)?.[1]
      if (rel) {
        const abs = join(contentDir, rel.replace(/\//g, '\\'))
        if (existsSync(abs)) {
          logoPath = abs
          break
        }
      }
    }

    return { identityName: identity, displayName: display, contentDir, exeNames, logoPath }
  } catch {
    return null
  }
}

/** PFN + AppId für unbekannte Identity-Namen per PowerShell nachschlagen. */
function resolvePackages(names: string[]): void {
  const unknown = names.filter((n) => !packageCache.has(n))
  if (unknown.length === 0 && gamingAppLocation !== undefined) return

  const list = unknown.map((n) => `'${n.replace(/'/g, "''")}'`).join(',')
  const script = `
    $out = @{ gamingApp = (Get-AppxPackage Microsoft.GamingApp -ErrorAction SilentlyContinue).InstallLocation; packages = @() }
    foreach ($n in @(${list || "''"})) {
      if (-not $n) { continue }
      $p = Get-AppxPackage -Name $n -ErrorAction SilentlyContinue
      if ($p) {
        $appId = 'Game'
        try { $appId = ((Get-AppxPackageManifest $p).Package.Applications.Application | Select-Object -First 1).Id } catch {}
        $out.packages += @{ name = $n; pfn = $p.PackageFamilyName; appId = "$appId" }
      } else {
        $out.packages += @{ name = $n; pfn = $null; appId = $null }
      }
    }
    $out | ConvertTo-Json -Depth 4 -Compress
  `
  try {
    // -EncodedCommand umgeht jede Quoting-Problematik.
    const encoded = Buffer.from(script, 'utf16le').toString('base64')
    const raw = execFileSync('powershell.exe', ['-NoProfile', '-EncodedCommand', encoded], {
      encoding: 'utf8',
      timeout: 30000,
      windowsHide: true
    })
    const json = JSON.parse(raw) as {
      gamingApp?: string | null
      packages?: { name: string; pfn: string | null; appId: string | null }[] | { name: string; pfn: string | null; appId: string | null }
    }
    gamingAppLocation = json.gamingApp ?? null
    const pkgs = Array.isArray(json.packages) ? json.packages : json.packages ? [json.packages] : []
    for (const p of pkgs) {
      packageCache.set(p.name, p.pfn ? { pfn: p.pfn, appId: p.appId || 'Game' } : null)
    }
  } catch {
    // PowerShell fehlgeschlagen -> Spiele trotzdem listen, nur ohne UWP-Start.
    if (gamingAppLocation === undefined) gamingAppLocation = null
  }
}

/** Pfad zum Logo der Xbox-App selbst (für den Launcher-Chip). */
export function getXboxAppIconPath(): string | null {
  if (gamingAppLocation === undefined) resolvePackages([])
  if (!gamingAppLocation) return null
  for (const name of [
    'Xbox_AppList.scale-200.png',
    'Xbox_AppList.scale-100.png',
    'Xbox_AppList.png'
  ]) {
    const p = join(gamingAppLocation, name)
    if (existsSync(p)) return p
  }
  return null
}

/** Xbox-Spiele erkennen und in die Bibliothek übernehmen. */
export function persistXbox(): number {
  const games: XboxGame[] = []
  for (const root of xboxGameRoots()) {
    let entries: string[]
    try {
      entries = readdirSync(root)
    } catch {
      continue
    }
    for (const entry of entries) {
      const game = parseGameConfig(join(root, entry, 'Content'))
      if (game) games.push(game)
    }
  }
  if (games.length === 0) return 0

  resolvePackages(games.map((g) => g.identityName))

  for (const game of games) {
    const pkg = packageCache.get(game.identityName)
    // Start über die UWP-Verknüpfung; ohne Paket-Info notfalls die exe direkt.
    let launchTarget: string | null = null
    if (pkg) {
      launchTarget =
        'spawn:' +
        JSON.stringify({
          exe: 'explorer.exe',
          args: [`shell:AppsFolder\\${pkg.pfn}!${pkg.appId}`]
        })
    } else if (game.exeNames[0]) {
      const exe = join(game.contentDir, game.exeNames[0])
      if (existsSync(exe)) launchTarget = exe
    }

    upsertGame({
      platform: 'xbox',
      platformId: game.identityName,
      name: game.displayName,
      installDir: game.contentDir, // Spielzeit-Tracking über laufende Prozesse
      coverPath: game.logoPath, // lokales Logo -> wird über cover:// ausgeliefert
      lastPlayed: null,
      importedPlaytimeSec: 0,
      kind: 'game',
      launchTarget,
      exeNames: game.exeNames.join(',') || null
    })
  }
  return games.length
}

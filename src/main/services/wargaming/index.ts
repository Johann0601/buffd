import { existsSync, readFileSync } from 'fs'
import { basename, join } from 'path'
import { upsertGame } from '../../db'

/**
 * Erkennt Wargaming-Spiele (World of Tanks/Warships/Warplanes …), die über den
 * EIGENSTÄNDIGEN Wargaming Game Center installiert sind — also NICHT über Steam.
 *
 * Maßgebliche Quelle ist die WGC-eigene preferences.xml: dort listet der Launcher
 * unter games_manager/games/game/working_dir jeden installierten Spielordner —
 * egal wohin der Nutzer installiert hat (liegt laut Doku immer in ProgramData).
 * Steam-Installationen werden übersprungen (die deckt der Steam-Scanner ab),
 * damit es keine Doppel-Einträge gibt.
 *
 * Pro Spielordner liefert game_metadata\metadata.xml Name, App-ID und exe-Namen,
 * game_metadata\game.ico ein Icon.
 */

const PROGRAM_DATA = process.env.ProgramData ?? 'C:\\ProgramData'
const WGC_DATA_DIRS = [
  join(PROGRAM_DATA, 'Wargaming.net', 'GameCenter'),
  join(PROGRAM_DATA, 'Wargaming.net', 'GameCenter for Steam')
]

/** working_dir-Pfade aller in einer preferences.xml registrierten Spiele. */
function readWorkingDirs(prefsPath: string): string[] {
  let xml = ''
  try {
    xml = readFileSync(prefsPath, 'utf8')
  } catch {
    return [] // keine preferences.xml -> keine Spiele
  }
  const dirs: string[] = []
  const re = /<working_dir>([^<]+)<\/working_dir>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) dirs.push(m[1].trim())
  return dirs
}

interface GameMeta {
  name: string
  appId: string // z. B. WOT.EU.PRODUCTION — stabil & eindeutig
  exeNames: string[] // Kleinschreibung, für den Spielzeit-Tracker
  exeRelPaths: string[] // relative exe-Pfade laut metadata (z. B. win64\WorldOfTanks.exe)
}

/** Name/App-ID/exe-Namen aus game_metadata\metadata.xml lesen. */
function readGameMeta(workingDir: string): GameMeta | null {
  let xml = ''
  try {
    xml = readFileSync(join(workingDir, 'game_metadata', 'metadata.xml'), 'utf8')
  } catch {
    return null
  }
  // Tags können Attribute tragen: das neuere WGC-Format (z. B. World of Tanks:
  // HEAT, metadata-Version 7.9) schreibt <app_id public="true">…</app_id> statt
  // <app_id>…</app_id>. Darum optionale Attribute im Regex zulassen, sonst wird
  // die App-ID nicht erkannt und das Spiel komplett übersprungen.
  const name = /<name(?:\s[^>]*)?>([^<]+)<\/name>/i.exec(xml)?.[1]?.trim()
  const appId = /<app_id(?:\s[^>]*)?>([^<]+)<\/app_id>/i.exec(xml)?.[1]?.trim()
  if (!name || !appId) return null

  // Nur die Spiel-exe(s) aus dem <executables>-Block lesen. Das neue Format
  // führt weitere <executable>-Tags in <post_install_action>/<pre_uninstall_action>
  // (z. B. der EasyAntiCheat-Installer) — die dürfen weder Start-Ziel noch
  // Tracking-exe werden. Fehlt der Block (altes Format ohne Wrapper), das ganze
  // Dokument durchsuchen.
  const execScope = /<executables>([\s\S]*?)<\/executables>/i.exec(xml)?.[1] ?? xml
  const exeRelPaths: string[] = []
  const exeNames = new Set<string>()
  const re = /<executable[^>]*>([^<]+)<\/executable>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(execScope))) {
    const rel = m[1].trim()
    exeRelPaths.push(rel)
    exeNames.add(basename(rel).toLowerCase())
  }
  return { name, appId, exeNames: [...exeNames], exeRelPaths }
}

/** Voller Pfad zur Spiel-exe, falls schon installiert (sonst null). */
function resolveGameExe(workingDir: string, relPaths: string[]): string | null {
  for (const rel of relPaths) {
    const full = join(workingDir, rel)
    if (existsSync(full)) return full
  }
  return null
}

/**
 * Erkennt eigenständig (nicht über Steam) installierte Wargaming-Spiele und
 * speichert sie als startbare Einträge (kind='game'). Gibt die Anzahl zurück.
 */
export function persistWargaming(): number {
  // working_dirs aus beiden WGC-Instanzen sammeln (dedupliziert), dazu eine
  // Launcher-exe als Start-Fallback für noch nicht fertig geladene Spiele.
  const workingDirs = new Set<string>()
  let launcherExe: string | null = null
  for (const dataDir of WGC_DATA_DIRS) {
    if (!existsSync(dataDir)) continue
    const wgc = join(dataDir, 'wgc.exe')
    if (!launcherExe && existsSync(wgc)) launcherExe = wgc
    for (const dir of readWorkingDirs(join(dataDir, 'preferences.xml'))) {
      workingDirs.add(dir)
    }
  }

  let count = 0
  for (const workingDir of workingDirs) {
    // Steam-Installationen überspringen — die deckt der Steam-Scanner ab.
    if (/[\\/]steamapps[\\/]/i.test(workingDir)) continue
    if (!existsSync(workingDir)) continue

    const meta = readGameMeta(workingDir)
    if (!meta) continue

    const gameExe = resolveGameExe(workingDir, meta.exeRelPaths)
    upsertGame({
      platform: 'wargaming',
      platformId: meta.appId,
      name: meta.name,
      installDir: workingDir,
      coverPath: null, // echtes Cover holt resolveMissingCovers per Name (SteamGridDB)
      lastPlayed: null,
      importedPlaytimeSec: 0,
      kind: 'game',
      launchTarget: gameExe ?? launcherExe, // Spiel direkt starten, sonst Launcher öffnen
      exeNames: meta.exeNames.join(',') || null
    })
    count++
  }
  return count
}

// Star Citizen (RSI): keine Spiele-Datenbank, kein URL-Schema — aber ein
// Installationsort mit Kanal-Ordnern (LIVE/PTU/…). Ein Kanal gilt als
// installiert, wenn die Spieldaten (Data.p4k) vorhanden sind. Gestartet wird
// der RSI Launcher (falls gefunden), sonst der Bootstrap im Spielordner.
//
// WICHTIG: Der Installort ist FREI WÄHLBAR. Star Citizen ist >100 GB, viele
// legen es auf eine andere Platte — ein fester Pfad übersieht diese
// Installationen (gemeldeter Bug: „RSI-Filter zeigt Star Citizen nicht an").
// Der RSI Launcher merkt sich den gewählten Ordner als `libraryFolder`; das
// Spiel liegt darunter als `<libraryFolder>\StarCitizen\<channel>`. Den Wert
// gibt es im Klartext nur im Launcher-Log (die store.json ist verschlüsselt,
// die leveldb kennt nur den relativen Unterordner). Zusätzlich wird der alte
// Default-Pfad geprüft.

import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { upsertGame } from '../../db'
import { findGameExeNames } from '../exeNames'

const DEFAULT_SC_ROOT = 'C:\\Program Files\\Roberts Space Industries\\StarCitizen'
const CHANNELS = ['LIVE', 'PTU', 'EPTU', 'TECH-PREVIEW']

const RSI_LAUNCHER_FALLBACKS = [
  'C:\\Program Files\\Roberts Space Industries\\RSI Launcher\\RSI Launcher.exe',
  `${process.env.LOCALAPPDATA ?? ''}\\Programs\\rsilauncher\\RSI Launcher.exe`
]

/**
 * Liest den vom Nutzer gewählten Game-Library-Ordner aus den RSI-Launcher-Logs.
 * Der Launcher schreibt seine Einstellungen dort im Klartext, z. B.
 * `"libraryFolder": "D:\\Star Citizen"`. Das letzte Vorkommen gewinnt (=
 * aktuellster Stand). Liefert null, wenn nichts gefunden wird.
 */
function libraryFolderFromLogs(): string | null {
  const logDir = join(process.env.APPDATA ?? '', 'rsilauncher', 'logs')
  if (!existsSync(logDir)) return null
  let found: string | null = null
  try {
    for (const file of readdirSync(logDir)) {
      if (!file.toLowerCase().endsWith('.log')) continue
      const text = readFileSync(join(logDir, file), 'utf8')
      const re = /"libraryFolder"\s*:\s*("(?:[^"\\]|\\.)*")/g
      let m: RegExpExecArray | null
      while ((m = re.exec(text))) {
        try {
          found = JSON.parse(m[1]) as string // JSON-Escapes (\\) korrekt auflösen
        } catch {
          /* kaputter Eintrag -> überspringen */
        }
      }
    }
  } catch {
    return null
  }
  return found && found.trim() ? found.trim() : null
}

/** Alle StarCitizen-Wurzelordner (konfigurierte Library + Default), dedupliziert. */
function starCitizenRoots(): string[] {
  const roots: string[] = []
  const lib = libraryFolderFromLogs()
  if (lib) roots.push(join(lib, 'StarCitizen')) // konfigurierte Library zuerst -> Vorrang
  roots.push(DEFAULT_SC_ROOT)
  return [...new Set(roots.map((r) => r.replace(/[\\/]+$/, '')))]
}

/**
 * Findet die RSI-Launcher-exe — egal wohin installiert. Der Installordner ist
 * frei wählbar; maßgeblich ist der Windows-Uninstall-Eintrag „RSI Launcher",
 * dessen `DisplayIcon` auf „…\RSI Launcher\uninstallerIcon.ico" zeigt. Daneben
 * liegt die „RSI Launcher.exe". Sonst feste Standardpfade.
 */
function resolveRsiLauncher(): string | null {
  const hives = [
    'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
  ]
  for (const hive of hives) {
    let out = ''
    try {
      out = execSync(`reg query "${hive}" /s`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        maxBuffer: 32 * 1024 * 1024 // Uninstall-Hive kann groß sein
      })
    } catch {
      continue // Hive nicht lesbar -> nächster
    }
    for (const block of out.split(/\r?\n(?=HKEY_)/)) {
      const nameMatch = block.match(/DisplayName\s+REG_SZ\s+(.+)/i)
      if (!nameMatch || !/^RSI Launcher/i.test(nameMatch[1].trim())) continue
      const iconMatch = block.match(/DisplayIcon\s+REG_SZ\s+(.+)/i)
      if (!iconMatch) continue
      // DisplayIcon „…\RSI Launcher\uninstallerIcon.ico,0" -> exe im selben Ordner.
      const iconPath = iconMatch[1].trim().replace(/,\d+\s*$/, '')
      const exe = join(iconPath.replace(/[\\/][^\\/]+$/, ''), 'RSI Launcher.exe')
      if (existsSync(exe)) return exe
    }
  }
  return RSI_LAUNCHER_FALLBACKS.find((c) => c && existsSync(c)) ?? null
}

/**
 * Erkennt installierte Star-Citizen-Kanäle und speichert sie als startbare
 * Einträge (kind='game'). Gibt die Anzahl zurück.
 */
export function persistRsi(): number {
  // Zuerst die installierten Kanäle sammeln (der erste Root, der einen Kanal
  // liefert, gewinnt -> konfigurierte Library vor Default).
  const installs: { platformId: string; channel: string; dir: string }[] = []
  const seen = new Set<string>()
  for (const root of starCitizenRoots()) {
    for (const channel of CHANNELS) {
      const dir = join(root, channel)
      if (!existsSync(join(dir, 'Data.p4k'))) continue // Kanal nicht installiert
      const platformId = `starcitizen-${channel.toLowerCase()}`
      if (seen.has(platformId)) continue
      seen.add(platformId)
      installs.push({ platformId, channel, dir })
    }
  }
  if (installs.length === 0) return 0 // nichts installiert -> teure Registry-Suche sparen

  const launcher = resolveRsiLauncher()
  for (const { platformId, channel, dir } of installs) {
    const channelLauncher = join(dir, 'StarCitizen_Launcher.exe')
    upsertGame({
      platform: 'rsi',
      platformId,
      name: channel === 'LIVE' ? 'Star Citizen' : `Star Citizen (${channel})`,
      installDir: dir,
      coverPath: null,
      lastPlayed: null,
      importedPlaytimeSec: 0,
      kind: 'game',
      // RSI Launcher bevorzugen, sonst der Bootstrap-Launcher im Spielordner.
      launchTarget: launcher ?? (existsSync(channelLauncher) ? channelLauncher : null),
      exeNames: findGameExeNames(dir).join(',') || null
    })
  }
  return installs.length
}

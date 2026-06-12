import { listGames, markMissingUninstalled } from '../db'
import { scanAndPersistSteam } from './steam'
import { persistEpic } from './epic'
import { persistLaunchers } from './launchers'
import { persistBattlenet } from './battlenet'
import { persistUbisoft } from './ubisoft'
import { persistRiot } from './riot'
import { persistRsi } from './rsi'
import { persistXbox } from './xbox'
import { resolveMissingCovers } from './covers'
import type { ScanResult } from '@shared/types'

/**
 * Kompletter Bibliotheks-Scan: Steam-Spiele + Epic-Spiele + installierte Launcher.
 * Jede Quelle ist gekapselt und darf einzeln fehlschlagen, ohne den Rest zu stoppen.
 */
export async function scanLibrary(): Promise<ScanResult> {
  let steamPath: string | null = null
  let libraries: string[] = []
  // Für den Deinstallations-Abgleich: nur Plattformen, deren Scan WIRKLICH
  // durchlief — sonst würde ein Wackler alle Spiele der Quelle "verstecken"
  // (selbstheilend wäre es trotzdem: der nächste Scan setzt installed wieder).
  const scanStartedAt = Math.floor(Date.now() / 1000)
  const scanned: string[] = []

  try {
    const steam = scanAndPersistSteam()
    steamPath = steam.steamPath
    libraries = steam.libraries
    scanned.push('steam')
  } catch {
    /* Steam-Scan fehlgeschlagen -> trotzdem weiter */
  }
  try {
    persistEpic()
    scanned.push('epic')
  } catch {
    /* Epic-Scan fehlgeschlagen -> trotzdem weiter */
  }
  // Welle 2: jede Quelle gekapselt, Fehler stoppen den Rest nicht.
  try {
    await persistBattlenet() // inkl. Update-Prüfung gegen Blizzards Versions-Server
    scanned.push('battlenet')
  } catch {
    /* weiter */
  }
  try {
    persistUbisoft()
    scanned.push('ubisoft')
  } catch {
    /* weiter */
  }
  try {
    persistRiot()
    scanned.push('riot')
  } catch {
    /* weiter */
  }
  try {
    persistRsi()
    scanned.push('rsi')
  } catch {
    /* weiter */
  }
  try {
    persistXbox() // Xbox-App-Spiele (XboxGames-Ordner) — vor den Launchern,
    // damit deren PowerShell-Abfrage auch das Xbox-App-Logo mitliefert
    scanned.push('xbox')
  } catch {
    /* weiter */
  }
  try {
    await persistLaunchers()
  } catch {
    /* Launcher-Erkennung fehlgeschlagen -> trotzdem weiter */
  }
  try {
    // Deinstalliert? Spiele, die dieser Scan nicht mehr gesehen hat, ausblenden
    // (Spielzeiten bleiben — eine Neuinstallation belebt den Eintrag wieder).
    markMissingUninstalled(scanned, scanStartedAt)
  } catch {
    /* weiter */
  }
  try {
    await resolveMissingCovers() // Online-Cover für Launcher ohne lokale Bilder
  } catch {
    /* weiter */
  }

  return { ok: true, steamPath, libraries, games: listGames() }
}

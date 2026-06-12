import { listGames } from '../db'
import { scanAndPersistSteam } from './steam'
import { persistEpic } from './epic'
import { persistLaunchers } from './launchers'
import { persistBattlenet } from './battlenet'
import { persistUbisoft } from './ubisoft'
import { persistRiot } from './riot'
import { persistRsi } from './rsi'
import { resolveMissingCovers } from './covers'
import type { ScanResult } from '@shared/types'

/**
 * Kompletter Bibliotheks-Scan: Steam-Spiele + Epic-Spiele + installierte Launcher.
 * Jede Quelle ist gekapselt und darf einzeln fehlschlagen, ohne den Rest zu stoppen.
 */
export async function scanLibrary(): Promise<ScanResult> {
  let steamPath: string | null = null
  let libraries: string[] = []

  try {
    const steam = scanAndPersistSteam()
    steamPath = steam.steamPath
    libraries = steam.libraries
  } catch {
    /* Steam-Scan fehlgeschlagen -> trotzdem weiter */
  }
  try {
    persistEpic()
  } catch {
    /* Epic-Scan fehlgeschlagen -> trotzdem weiter */
  }
  // Welle 2: jede Quelle gekapselt, Fehler stoppen den Rest nicht.
  try {
    await persistBattlenet() // inkl. Update-Prüfung gegen Blizzards Versions-Server
  } catch {
    /* weiter */
  }
  try {
    persistUbisoft()
  } catch {
    /* weiter */
  }
  try {
    persistRiot()
  } catch {
    /* weiter */
  }
  try {
    persistRsi()
  } catch {
    /* weiter */
  }
  try {
    await persistLaunchers()
  } catch {
    /* Launcher-Erkennung fehlgeschlagen -> trotzdem weiter */
  }
  try {
    await resolveMissingCovers() // Online-Cover für Launcher ohne lokale Bilder
  } catch {
    /* weiter */
  }

  return { ok: true, steamPath, libraries, games: listGames() }
}

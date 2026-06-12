// Speicherplatz-Analyse: berechnet die Ordnergröße jedes installierten Spiels.
// Das Durchlaufen großer Spielordner (Star Citizen: >100.000 Dateien) dauert
// einige Sekunden — darum läuft die Analyse asynchron, meldet jedes fertige
// Spiel einzeln an die Oberfläche und cacht das Ergebnis in der Datenbank.

import { existsSync } from 'fs'
import { readdir, stat } from 'fs/promises'
import { join } from 'path'
import type { GameStorageInfo } from '@shared/types'
import { listGamesForStorage, setGameSize } from '../db'

/**
 * Größe eines Ordners in Bytes (rekursiv). Symbolische Links/Junctions werden
 * übersprungen (sonst drohen Endlosschleifen und doppelt gezählte Daten);
 * unlesbare Unterordner werden still ignoriert.
 */
export async function folderSize(dir: string): Promise<number> {
  let total = 0
  const queue: string[] = [dir]

  while (queue.length > 0) {
    const current = queue.pop()!
    let entries
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      continue // kein Zugriff -> überspringen
    }

    // Dateigrößen eines Ordners parallel abfragen (deutlich schneller als einzeln).
    const files: string[] = []
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue
      const full = join(current, entry.name)
      if (entry.isDirectory()) queue.push(full)
      else if (entry.isFile()) files.push(full)
    }
    const sizes = await Promise.all(
      files.map((f) => stat(f).then((s) => s.size).catch(() => 0))
    )
    for (const s of sizes) total += s
  }

  return total
}

/** Aktueller (gecachter) Stand der Speicherbelegung — nur existierende Ordner. */
export function listGameStorage(): GameStorageInfo[] {
  return listGamesForStorage().filter((g) => existsSync(g.installDir))
}

// Schutz vor Doppel-Läufen (z. B. zweimal schnell auf "Berechnen" geklickt).
let analyzing = false

/**
 * Berechnet die Größe ALLER installierten Spiele neu. Nach jedem fertigen
 * Spiel wird onProgress aufgerufen (-> Live-Updates in der Oberfläche).
 */
export async function analyzeGameStorage(
  onProgress: (info: GameStorageInfo) => void
): Promise<GameStorageInfo[]> {
  if (analyzing) return listGameStorage()
  analyzing = true
  try {
    for (const game of listGameStorage()) {
      const sizeBytes = await folderSize(game.installDir)
      setGameSize(game.gameId, sizeBytes)
      onProgress({ ...game, sizeBytes, checkedAt: Math.floor(Date.now() / 1000) })
    }
    return listGameStorage()
  } finally {
    analyzing = false
  }
}

/** Größe EINES Spiels (neu) berechnen — für die Detailseite. */
export async function computeGameSize(gameId: number): Promise<number | null> {
  const game = listGamesForStorage().find((g) => g.gameId === gameId)
  if (!game || !existsSync(game.installDir)) return null
  const sizeBytes = await folderSize(game.installDir)
  setGameSize(gameId, sizeBytes)
  return sizeBytes
}

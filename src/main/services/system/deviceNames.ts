// Vom Nutzer vergebene eigene Gerätenamen (z. B. "Logitech Pro X Superlight 2"
// statt des generischen "LIGHTSPEED Receiver", den Windows meldet).
//
// Warum nötig: Funk-Mäuse hängen an einem generischen Empfänger; ihr echtes
// Modell steht NICHT in Windows. Damit der Nutzer es trotzdem sauber benennen
// kann, merken wir uns hier id -> Name. Kein Geheimnis -> einfache JSON-Datei
// im userData-Ordner (nicht verschlüsselt), Schlüssel ist die stabile Geräte-id.

import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

type NameMap = Record<string, string>

let cached: NameMap | undefined // undefined = noch nicht geladen

function filePath(): string {
  return join(app.getPath('userData'), 'device-names.json')
}

function load(): NameMap {
  if (cached !== undefined) return cached
  cached = {}
  try {
    if (existsSync(filePath())) {
      const parsed = JSON.parse(readFileSync(filePath(), 'utf8'))
      if (parsed && typeof parsed === 'object') cached = parsed as NameMap
    }
  } catch {
    cached = {} // beschädigt -> wie "keine eigenen Namen"
  }
  return cached
}

/** Alle eigenen Namen (id -> Name). */
export function getDeviceNames(): NameMap {
  return load()
}

/** Eigenen Namen setzen; name = null/leer -> wieder auf den Originalnamen zurück. */
export function setDeviceName(id: string, name: string | null): void {
  const map = { ...load() }
  const trimmed = (name ?? '').trim()
  if (trimmed) map[id] = trimmed
  else delete map[id]
  cached = map
  try {
    writeFileSync(filePath(), JSON.stringify(map))
  } catch {
    // Schreibfehler ignorieren (z. B. Datei gesperrt) — Cache bleibt aktuell.
  }
}

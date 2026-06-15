// Lokale, selbst aufgenommene Steam-Screenshots eines Spiels.
// Steam legt sie unter userdata\<konto>\760\remote\<appid>\screenshots\ ab
// (Vollbild) plus einem thumbnails\-Unterordner (Vorschau). Diese Dateien
// werden über das shot://-Protokoll an den Renderer ausgeliefert.

import { shell, clipboard, nativeImage } from 'electron'
import { existsSync, readdirSync, statSync } from 'fs'
import { basename, dirname, join } from 'path'
import type { GameScreenshot } from '@shared/types'
import { resolveSteamPath } from './scanner'

// Erlaubte Screenshot-Dateipfade. Wird beim Auflisten gefüllt; das shot://-
// Protokoll liefert NUR Dateien aus diesem Set aus (kein willkürlicher
// Dateisystem-Zugriff von außen).
const allowed = new Set<string>()

const IMG = /\.(jpg|jpeg|png)$/i

/** Prüft, ob ein Pfad zuvor als gültiger Screenshot aufgelistet wurde. */
export function isAllowedShot(path: string): boolean {
  return allowed.has(path)
}

/** Dekodiert den in der shot://-URL eingebetteten Dateipfad. */
export function decodeShotPath(encoded: string): string | null {
  try {
    return Buffer.from(encoded, 'base64url').toString('utf8')
  } catch {
    return null
  }
}

function shotUrl(path: string): string {
  // shot://file/<base64url-pfad> — der Protokoll-Handler dekodiert ihn wieder.
  return 'shot://file/' + Buffer.from(path).toString('base64url')
}

/**
 * Findet die lokal gespeicherten Screenshots zu einer Steam-AppID. Mehrere
 * Konten (mehrere Profile auf dem PC) werden zusammengeführt; neueste zuerst.
 */
export function listSteamScreenshots(appId: string): GameScreenshot[] {
  const steamPath = resolveSteamPath()
  if (!steamPath) return []
  const userdata = join(steamPath, 'userdata')
  if (!existsSync(userdata)) return []

  let accounts: string[]
  try {
    accounts = readdirSync(userdata)
  } catch {
    return []
  }

  const shots: GameScreenshot[] = []
  for (const acct of accounts) {
    const dir = join(userdata, acct, '760', 'remote', appId, 'screenshots')
    if (!existsSync(dir)) continue
    let files: string[]
    try {
      files = readdirSync(dir)
    } catch {
      continue
    }
    for (const file of files) {
      if (!IMG.test(file)) continue
      const full = join(dir, file)
      let mtime = 0
      try {
        const st = statSync(full)
        if (!st.isFile()) continue // thumbnails\ ist ein Ordner -> übersprungen
        mtime = Math.floor(st.mtimeMs / 1000)
      } catch {
        continue
      }
      const thumbPath = join(dir, 'thumbnails', file)
      const thumb = existsSync(thumbPath) ? thumbPath : full
      allowed.add(full)
      allowed.add(thumb)
      shots.push({ full: shotUrl(full), thumb: shotUrl(thumb), takenAt: mtime })
    }
  }

  shots.sort((a, b) => b.takenAt - a.takenAt)
  return shots
}

// --- Verwalten (kopieren / im Ordner zeigen / löschen) -----------------------

/** Wandelt eine shot://-URL in einen erlaubten, existierenden Dateipfad um. */
function resolveShotUrl(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.protocol !== 'shot:') return null
    const encoded = decodeURIComponent(u.pathname.replace(/^\//, ''))
    const path = decodeShotPath(encoded)
    if (path && isAllowedShot(path) && existsSync(path)) return path
  } catch {
    /* defekte URL -> null */
  }
  return null
}

/** Screenshot als Bild in die Zwischenablage kopieren (z. B. zum Einfügen im Chat). */
export function copyScreenshot(url: string): boolean {
  const path = resolveShotUrl(url)
  if (!path) return false
  const img = nativeImage.createFromPath(path)
  if (img.isEmpty()) return false
  clipboard.writeImage(img)
  return true
}

/** Den Screenshot im Datei-Explorer anzeigen (markiert die Datei). */
export function revealScreenshot(url: string): boolean {
  const path = resolveShotUrl(url)
  if (!path) return false
  shell.showItemInFolder(path)
  return true
}

/** Screenshot (+ zugehörige Vorschau) in den Papierkorb verschieben — umkehrbar. */
export async function deleteScreenshot(url: string): Promise<boolean> {
  const path = resolveShotUrl(url)
  if (!path) return false
  try {
    await shell.trashItem(path)
    const thumb = join(dirname(path), 'thumbnails', basename(path))
    if (existsSync(thumb)) {
      try {
        await shell.trashItem(thumb)
      } catch {
        /* Vorschau lässt sich nicht entfernen -> nicht schlimm */
      }
    }
    allowed.delete(path)
    return true
  } catch {
    return false
  }
}

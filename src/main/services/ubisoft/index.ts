// Ubisoft-Connect-Spiele: Die Registry listet unter Launcher\Installs jede
// Installation mit ID + Pfad. Der Anzeigename ist dort nicht hinterlegt —
// wir nehmen den Ordnernamen (z. B. "XDefiant"). Start per uplay://-URL,
// dieselbe Technik wie bei Steam/Epic.

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { basename } from 'path'
import { upsertGame } from '../../db'
import { findGameExeNames } from '../exeNames'

export function persistUbisoft(): number {
  let out = ''
  try {
    out = execSync('reg query "HKLM\\SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs" /s', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    })
  } catch {
    return 0 // Schlüssel existiert nicht -> kein Ubisoft Connect / keine Spiele
  }

  let count = 0
  // Die Ausgabe besteht aus Blöcken: Schlüsselpfad (mit der Spiel-ID),
  // darunter die Werte — uns interessiert InstallDir.
  for (const block of out.split(/\r?\n(?=HKEY_)/)) {
    const idMatch = block.match(/Installs\\(\d+)/)
    const dirMatch = block.match(/InstallDir\s+REG_SZ\s+(.+)/)
    if (!idMatch || !dirMatch) continue

    const dir = dirMatch[1].trim().replace(/\//g, '\\').replace(/\\+$/, '')
    if (!existsSync(dir)) continue

    upsertGame({
      platform: 'ubisoft',
      platformId: idMatch[1],
      name: basename(dir),
      installDir: dir,
      coverPath: null,
      lastPlayed: null,
      importedPlaytimeSec: 0,
      kind: 'game',
      launchTarget: `uplay://launch/${idMatch[1]}/0`,
      exeNames: findGameExeNames(dir).join(',') || null
    })
    count++
  }
  return count
}

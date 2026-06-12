// Star Citizen (RSI): keine Spiele-Datenbank, kein URL-Schema — aber ein
// fester Installationsort mit Kanal-Ordnern (LIVE/PTU/…). Ein Kanal gilt als
// installiert, wenn die Spieldaten (Data.p4k) vorhanden sind. Gestartet wird
// der RSI Launcher (falls installiert), sonst der Bootstrap im Spielordner.

import { existsSync } from 'fs'
import { join } from 'path'
import { upsertGame } from '../../db'
import { findGameExeNames } from '../exeNames'

const SC_ROOT = 'C:\\Program Files\\Roberts Space Industries\\StarCitizen'
const CHANNELS = ['LIVE', 'PTU', 'EPTU', 'TECH-PREVIEW']

const RSI_LAUNCHER_CANDIDATES = [
  'C:\\Program Files\\Roberts Space Industries\\RSI Launcher\\RSI Launcher.exe',
  `${process.env.LOCALAPPDATA ?? ''}\\Programs\\rsilauncher\\RSI Launcher.exe`
]

export function persistRsi(): number {
  let count = 0
  for (const channel of CHANNELS) {
    const dir = join(SC_ROOT, channel)
    if (!existsSync(join(dir, 'Data.p4k'))) continue // Kanal nicht installiert

    const launcher =
      RSI_LAUNCHER_CANDIDATES.find((c) => c && existsSync(c)) ??
      (existsSync(join(dir, 'StarCitizen_Launcher.exe'))
        ? join(dir, 'StarCitizen_Launcher.exe')
        : null)

    upsertGame({
      platform: 'rsi',
      platformId: `starcitizen-${channel.toLowerCase()}`,
      name: channel === 'LIVE' ? 'Star Citizen' : `Star Citizen (${channel})`,
      installDir: dir,
      coverPath: null,
      lastPlayed: null,
      importedPlaytimeSec: 0,
      kind: 'game',
      launchTarget: launcher, // exe-Pfad -> shell.openPath
      exeNames: findGameExeNames(dir).join(',') || null
    })
    count++
  }
  return count
}

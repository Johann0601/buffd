import { app } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { upsertGame } from '../../db'
import { resolveSteamPath } from '../steam/scanner'
import type { Platform } from '@shared/types'

interface LauncherDef {
  platform: Platform
  name: string
  candidates: string[] // mögliche exe-Pfade, erster Treffer gewinnt
  launchTarget?: string // Sonderfälle (z. B. UWP-Apps) — überschreibt den exe-Pfad
  alwaysPresent?: boolean // ohne prüfbare exe (UWP) -> immer anbieten
}

function launcherDefs(): LauncherDef[] {
  const localApp = process.env.LOCALAPPDATA ?? ''
  const steamPath = resolveSteamPath()
  return [
    {
      platform: 'steam',
      name: 'Steam',
      candidates: [
        ...(steamPath ? [join(steamPath, 'steam.exe')] : []),
        'C:\\Program Files (x86)\\Steam\\steam.exe',
        'C:\\Program Files\\Steam\\steam.exe'
      ]
    },
    {
      platform: 'epic',
      name: 'Epic Games',
      candidates: [
        'C:\\Program Files (x86)\\Epic Games\\Launcher\\Portal\\Binaries\\Win64\\EpicGamesLauncher.exe',
        'C:\\Program Files\\Epic Games\\Launcher\\Portal\\Binaries\\Win64\\EpicGamesLauncher.exe'
      ]
    },
    {
      platform: 'modrinth',
      name: 'Modrinth',
      candidates: [
        `${localApp}\\Modrinth App\\theseus_gui.exe`,
        `${localApp}\\Programs\\Modrinth App\\Modrinth App.exe`
      ]
    },
    {
      platform: 'curseforge',
      name: 'CurseForge',
      candidates: [
        `${localApp}\\Programs\\CurseForge Windows\\CurseForge.exe`,
        `${localApp}\\Programs\\CurseForge\\CurseForge.exe`
      ]
    },
    {
      platform: 'ftb',
      name: 'FTB App',
      candidates: [`${localApp}\\Programs\\ftb-app\\FTB Electron App.exe`]
    },
    {
      platform: 'battlenet',
      name: 'Battle.net',
      candidates: [
        'C:\\Program Files (x86)\\Battle.net\\Battle.net.exe',
        'C:\\Program Files\\Battle.net\\Battle.net.exe'
      ]
    },
    {
      platform: 'ubisoft',
      name: 'Ubisoft Connect',
      candidates: [
        'C:\\Program Files (x86)\\Ubisoft\\Ubisoft Game Launcher\\UbisoftConnect.exe',
        'C:\\Program Files (x86)\\Ubisoft\\Ubisoft Game Launcher\\upc.exe'
      ]
    },
    {
      platform: 'riot',
      name: 'Riot Client',
      candidates: ['C:\\Riot Games\\Riot Client\\RiotClientServices.exe']
    },
    {
      platform: 'ea',
      name: 'EA App',
      candidates: ['C:\\Program Files\\Electronic Arts\\EA Desktop\\EA Desktop\\EADesktop.exe']
    },
    {
      platform: 'rsi',
      name: 'RSI Launcher',
      candidates: [
        'C:\\Program Files\\Roberts Space Industries\\RSI Launcher\\RSI Launcher.exe',
        `${localApp}\\Programs\\rsilauncher\\RSI Launcher.exe`
      ]
    },
    {
      platform: 'wargaming',
      name: 'Wargaming Game Center',
      candidates: [
        'C:\\ProgramData\\Wargaming.net\\GameCenter\\wgc.exe',
        'C:\\ProgramData\\Wargaming.net\\GameCenter for Steam\\wgc.exe'
      ]
    },
    {
      platform: 'rockstar',
      name: 'Rockstar Games',
      candidates: [
        'C:\\Program Files\\Rockstar Games\\Launcher\\Launcher.exe',
        'C:\\Program Files (x86)\\Rockstar Games\\Launcher\\Launcher.exe'
      ]
    },
    {
      platform: 'xbox',
      name: 'Xbox App',
      candidates: [], // UWP-App ohne klassische exe
      alwaysPresent: true, // gehört zur Windows-Grundausstattung
      launchTarget:
        'spawn:' +
        JSON.stringify({
          exe: 'explorer.exe',
          args: ['shell:AppsFolder\\Microsoft.GamingApp_8wekyb3d8bbwe!Microsoft.Xbox.App']
        })
    }
  ]
}

/**
 * Erkennt installierte Launcher und speichert sie als startbare Einträge (kind='launcher').
 * Das echte Programm-Icon wird als data:-URL gespeichert und direkt angezeigt.
 */
export async function persistLaunchers(): Promise<number> {
  let count = 0
  for (const def of launcherDefs()) {
    const exe = def.candidates.find((c) => c && existsSync(c))
    if (!exe && !def.alwaysPresent) continue // nicht installiert -> überspringen

    let iconDataUrl: string | null = null
    if (exe) {
      try {
        const icon = await app.getFileIcon(exe, { size: 'large' })
        if (!icon.isEmpty()) iconDataUrl = icon.toDataURL()
      } catch {
        // kein Icon -> Buchstaben-Platzhalter
      }
    }

    upsertGame({
      platform: def.platform,
      platformId: 'launcher', // pro Plattform eindeutig (Spiele nutzen ihre eigene ID)
      name: def.name,
      installDir: null, // Launcher werden NICHT zeitlich getrackt
      coverPath: iconDataUrl,
      lastPlayed: null,
      importedPlaytimeSec: 0,
      kind: 'launcher',
      launchTarget: def.launchTarget ?? exe ?? null, // exe via openPath, Sonderfälle via spawn:
      exeNames: null // Launcher werden nicht getrackt
    })
    count++
  }
  return count
}

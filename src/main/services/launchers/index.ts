import { app, nativeImage } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { upsertGame } from '../../db'
import { resolveSteamPath } from '../steam/scanner'
import { getXboxAppIconPath } from '../xbox'
import type { Platform } from '@shared/types'

/**
 * Findet die echte wgc.exe des Wargaming Game Center — egal wohin der Nutzer es
 * installiert hat. Der Installordner ist frei wählbar, deshalb sind feste Pfade
 * unzuverlässig (besonders bei der Standalone-Variante, die NICHT in ProgramData
 * liegen muss). Maßgeblich ist der Windows-Uninstall-Eintrag: dessen `InstallLocation`
 * ist bei WGC leer, aber `DisplayIcon` zeigt direkt auf "...\wgc.exe,0".
 * Die Standalone-Version heißt "Wargaming.net Game Center", die Steam-Variante
 * "... for Steam" — wir bevorzugen die Standalone, fallen aber auf jede gefundene zurück.
 */
function resolveWargamingExe(): string | null {
  const hives = [
    'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
  ]
  let standalone: string | null = null
  let steam: string | null = null

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
    // Ausgabe in Blöcke pro Schlüssel zerlegen (jeder beginnt mit HKEY_...).
    for (const block of out.split(/\r?\n(?=HKEY_)/)) {
      const nameMatch = block.match(/DisplayName\s+REG_SZ\s+(.+)/i)
      const iconMatch = block.match(/DisplayIcon\s+REG_SZ\s+(.+)/i)
      if (!nameMatch || !iconMatch) continue
      const name = nameMatch[1].trim()
      if (!/^Wargaming\.net Game Center/i.test(name)) continue
      // DisplayIcon ist "C:\...\wgc.exe,0" — den Icon-Index abschneiden.
      const exe = iconMatch[1].trim().replace(/,\d+\s*$/, '')
      if (!/wgc\.exe$/i.test(exe) || !existsSync(exe)) continue
      if (/for Steam/i.test(name)) {
        steam ??= exe
      } else {
        standalone ??= exe
      }
    }
    if (standalone) break // Standalone gefunden -> reicht
  }
  return standalone ?? steam
}

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
  const wgcExe = resolveWargamingExe()
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
        ...(wgcExe ? [wgcExe] : []), // echter Pfad aus der Registry (Standalone bevorzugt)
        'C:\\Program Files (x86)\\Wargaming.net\\GameCenter\\wgc.exe',
        'C:\\Program Files\\Wargaming.net\\GameCenter\\wgc.exe',
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
    // UWP-Apps (Xbox) haben keine exe — deren Logo-PNG liegt im Paketordner.
    if (!iconDataUrl && def.platform === 'xbox') {
      const logoPath = getXboxAppIconPath()
      if (logoPath) {
        try {
          const icon = nativeImage.createFromPath(logoPath).resize({ width: 64 })
          if (!icon.isEmpty()) iconDataUrl = icon.toDataURL()
        } catch {
          /* Buchstaben-Platzhalter */
        }
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

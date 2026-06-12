// Riot-Spiele (League of Legends, VALORANT, …): Die Metadaten liegen als
// YAML-Dateien unter C:\ProgramData\Riot Games\Metadata\<produkt>.<patchline>\.
// Installierte Spiele haben dort einen product_install_full_path. Gestartet
// wird über den Riot Client: RiotClientServices.exe --launch-product=…

import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { upsertGame } from '../../db'
import { findGameExeNames } from '../exeNames'

const METADATA_DIR = 'C:\\ProgramData\\Riot Games\\Metadata'
const CLIENT_INSTALLS = 'C:\\ProgramData\\Riot Games\\RiotClientInstalls.json'

const RIOT_NAMES: Record<string, string> = {
  league_of_legends: 'League of Legends',
  valorant: 'VALORANT',
  bacon: 'Legends of Runeterra',
  teamfighttactics: 'Teamfight Tactics'
}

/** Pfad zum Riot Client (steht in RiotClientInstalls.json). */
function riotClientExe(): string | null {
  try {
    const json = JSON.parse(readFileSync(CLIENT_INSTALLS, 'utf8')) as {
      rc_default?: string
      rc_live?: string
    }
    const exe = (json.rc_default ?? json.rc_live)?.replace(/\//g, '\\')
    return exe && existsSync(exe) ? exe : null
  } catch {
    return null
  }
}

export function persistRiot(): number {
  if (!existsSync(METADATA_DIR)) return 0
  const clientExe = riotClientExe()
  let count = 0

  for (const entry of readdirSync(METADATA_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.includes('.')) continue // "Riot Client" o. ä.
    const [product, patchline] = entry.name.split('.')
    const yamlPath = join(METADATA_DIR, entry.name, `${entry.name}.product_settings.yaml`)
    if (!existsSync(yamlPath)) continue

    // Nur wirklich installierte Produkte haben einen vollständigen Pfad.
    const yaml = readFileSync(yamlPath, 'utf8')
    const pathMatch = yaml.match(/product_install_full_path:\s*"?([^"\r\n]+)"?/)
    if (!pathMatch) continue
    const dir = pathMatch[1].trim().replace(/\//g, '\\').replace(/\\+$/, '')
    if (!existsSync(dir)) continue

    const launchTarget = clientExe
      ? 'spawn:' +
        JSON.stringify({
          exe: clientExe,
          args: [`--launch-product=${product}`, `--launch-patchline=${patchline}`]
        })
      : null

    upsertGame({
      platform: 'riot',
      platformId: entry.name,
      name: RIOT_NAMES[product] ?? product,
      installDir: dir,
      coverPath: null,
      lastPlayed: null,
      importedPlaytimeSec: 0,
      kind: 'game',
      launchTarget,
      exeNames: findGameExeNames(dir).join(',') || null
    })
    count++
  }
  return count
}

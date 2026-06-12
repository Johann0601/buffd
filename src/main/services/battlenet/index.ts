// Battle.net-Spiele: Die Agent-Datenbank (product.db, Protobuf) enthält die
// Installationspfade aller verwalteten Spiele als Klartext-Strings — wir
// fischen die Pfade heraus und ordnen sie über den Ordnernamen den bekannten
// Produkt-Codes zu. Start gezielt per `Battle.net.exe --exec="launch <Code>"`.

import { existsSync, readFileSync } from 'fs'
import { basename, join } from 'path'
import { applyUpdateState, upsertGame } from '../../db'
import { findGameExeNames } from '../exeNames'

const PRODUCT_DB = 'C:\\ProgramData\\Battle.net\\Agent\\product.db'

const BNET_EXE_CANDIDATES = [
  'C:\\Program Files (x86)\\Battle.net\\Battle.net.exe',
  'C:\\Program Files\\Battle.net\\Battle.net.exe'
]

/** Ordnername -> offizieller Launch-Code + Anzeigename. */
const PRODUCT_BY_FOLDER: Record<string, { code: string; name: string }> = {
  Hearthstone: { code: 'WTCG', name: 'Hearthstone' },
  'Call of Duty': { code: 'AUKS', name: 'Call of Duty' },
  'World of Warcraft': { code: 'WoW', name: 'World of Warcraft' },
  Overwatch: { code: 'Pro', name: 'Overwatch 2' },
  'Diablo IV': { code: 'Fen', name: 'Diablo IV' },
  'Diablo III': { code: 'D3', name: 'Diablo III' },
  'Diablo II Resurrected': { code: 'OSI', name: 'Diablo II: Resurrected' },
  'StarCraft II': { code: 'S2', name: 'StarCraft II' },
  StarCraft: { code: 'S1', name: 'StarCraft: Remastered' },
  'Heroes of the Storm': { code: 'Hero', name: 'Heroes of the Storm' },
  'Warcraft III': { code: 'W3', name: 'Warcraft III: Reforged' }
}

// Pfad-Strings aus der Binärdatei herausfischen: Laufwerksbuchstabe gefolgt
// von üblichen Pfadzeichen (Positivliste — Binärmüll bricht den Treffer ab).
const PATH_PATTERN = /[A-Za-z]:[/\\][\w /\\.()&'!,+-]{3,100}/g

/** Launch-Code -> NGDP-Produktcode des öffentlichen Versions-Servers. */
const NGDP_BY_CODE: Record<string, string> = {
  WTCG: 'hsb',
  AUKS: 'auks',
  WoW: 'wow',
  Pro: 'pro',
  Fen: 'fenris',
  D3: 'd3',
  OSI: 'osi',
  S2: 's2',
  S1: 's1',
  Hero: 'hero',
  W3: 'w3'
}

/** Installierte Versions-Strings aus der .product.db des Spielordners. */
function readLocalVersions(installDir: string): string[] {
  try {
    const raw = readFileSync(join(installDir, '.product.db')).toString('utf8')
    const found = raw.match(/\d+\.\d+\.\d+\.\d+/g) ?? []
    return [...new Set(found)]
  } catch {
    return []
  }
}

/** Neueste Version laut Blizzards öffentlichem Versions-Server (Region eu). */
async function fetchLatestVersion(ngdp: string): Promise<string | null> {
  try {
    const res = await fetch(`http://eu.patch.battle.net:1119/${ngdp}/versions`, {
      signal: AbortSignal.timeout(10000)
    })
    if (!res.ok) return null
    const text = await res.text()
    // Zeilenformat: region|BuildConfig|CDNConfig|KeyRing|BuildId|VersionsName|…
    for (const line of text.split('\n')) {
      const cols = line.split('|')
      if (cols[0] === 'eu' && cols[5]) return cols[5].trim()
    }
    return null
  } catch {
    return null // offline o. ä. -> keine Update-Aussage
  }
}

/**
 * Update-Prüfung pro Battle.net-Spiel: installierte Version (lokale .product.db)
 * gegen die neueste Version des Versions-Servers — wie StateFlags bei Steam.
 */
async function checkBattlenetUpdates(
  games: { code: string; installDir: string }[]
): Promise<void> {
  for (const g of games) {
    const ngdp = NGDP_BY_CODE[g.code]
    if (!ngdp) continue
    const local = readLocalVersions(g.installDir)
    if (local.length === 0) continue
    const latest = await fetchLatestVersion(ngdp)
    if (!latest) continue
    const pending = !local.includes(latest)
    const installed = local.includes(latest) ? latest : local[0]
    applyUpdateState('battlenet', g.code, installed, pending, null)
  }
}

export async function persistBattlenet(): Promise<number> {
  if (!existsSync(PRODUCT_DB)) return 0
  const text = readFileSync(PRODUCT_DB).toString('utf8')
  const bnetExe = BNET_EXE_CANDIDATES.find((c) => existsSync(c)) ?? null

  const seen = new Set<string>()
  const forUpdateCheck: { code: string; installDir: string }[] = []
  let count = 0
  for (const m of text.matchAll(PATH_PATTERN)) {
    const dir = m[0].replace(/\//g, '\\').replace(/[\\ ]+$/, '')
    // Eigene Battle.net-/Agent-Ordner sind keine Spiele.
    if (/battle\.net|programdata/i.test(dir)) continue
    if (seen.has(dir.toLowerCase()) || !existsSync(dir)) continue
    seen.add(dir.toLowerCase())

    const folder = basename(dir)
    const known = PRODUCT_BY_FOLDER[folder]
    const launchTarget = bnetExe
      ? known
        ? 'spawn:' + JSON.stringify({ exe: bnetExe, args: [`--exec=launch ${known.code}`] })
        : bnetExe // unbekanntes Produkt: wenigstens Battle.net öffnen
      : null

    upsertGame({
      platform: 'battlenet',
      platformId: known?.code ?? folder,
      name: known?.name ?? folder,
      installDir: dir,
      coverPath: null, // keine lokalen Cover -> Buchstaben-Kachel
      lastPlayed: null,
      importedPlaytimeSec: 0,
      kind: 'game',
      launchTarget,
      exeNames: findGameExeNames(dir).join(',') || null
    })
    if (known) forUpdateCheck.push({ code: known.code, installDir: dir })
    count++
  }

  await checkBattlenetUpdates(forUpdateCheck)
  return count
}

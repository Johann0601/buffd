// IsThereAnyDeal-Anbindung (Preisvergleich über viele Shops + historischer
// Tiefstpreis). Braucht einen kostenlosen API-Key (isthereanydeal.com ->
// anmelden -> dev/apps -> App registrieren). Geprüfte Endpunkte (API v2):
//   GET  /games/lookup/v1?key=K&appid=<steam-appid>  -> ITAD-Game-ID
//   POST /games/prices/v3?key=K&country=DE  body ["<game-id>"]
//        -> deals[] (shop/price/cut/url) + historyLow.all

import type { ItadStatus } from '@shared/types'
import { getStoredKey, setStoredKey } from './keys'

const API = 'https://api.isthereanydeal.com'

function getItadKey(): string | null {
  return getStoredKey('itadApiKey')
}

export function itadStatus(): ItadStatus {
  return { connected: getItadKey() !== null }
}

/** Key prüfen (Probe-Anfrage) und bei Erfolg verschlüsselt speichern. */
export async function setItadKey(
  key: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cleaned = key.trim()
  if (cleaned.length < 16) {
    return { ok: false, error: 'Der Key sieht zu kurz aus — bitte den kompletten Wert einfügen.' }
  }
  try {
    const res = await fetch(`${API}/games/lookup/v1?key=${cleaned}&appid=730`, {
      signal: AbortSignal.timeout(10000)
    })
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: 'IsThereAnyDeal hat den Key abgelehnt — bitte prüfen.' }
    }
    if (!res.ok) return { ok: false, error: `IsThereAnyDeal antwortet nicht (HTTP ${res.status}).` }
  } catch {
    return { ok: false, error: 'Keine Verbindung zu IsThereAnyDeal — bist du online?' }
  }
  setStoredKey('itadApiKey', cleaned)
  return { ok: true }
}

export function clearItadKey(): ItadStatus {
  setStoredKey('itadApiKey', null)
  return itadStatus()
}

// Steam-AppID -> ITAD-Game-ID ändert sich nie -> pro Sitzung merken.
const gameIdCache = new Map<number, string | null>()

async function lookupGameId(key: string, appId: number): Promise<string | null> {
  const cached = gameIdCache.get(appId)
  if (cached !== undefined) return cached
  let id: string | null = null
  try {
    const res = await fetch(`${API}/games/lookup/v1?key=${key}&appid=${appId}`, {
      signal: AbortSignal.timeout(10000)
    })
    if (res.ok) {
      const json = (await res.json()) as { found?: boolean; game?: { id?: string } }
      id = json.found && json.game?.id ? json.game.id : null
    }
  } catch {
    return null // Fehler NICHT negativ cachen — später erneut versuchen
  }
  gameIdCache.set(appId, id)
  return id
}

export interface ItadPrices {
  best: { shop: string; priceCents: number; cut: number; url: string } | null
  historyLowCents: number | null
}

interface PriceAmount {
  amount: number
  amountInt: number // Cent
  currency: string
}

interface DealEntry {
  shop?: { name?: string }
  price?: PriceAmount
  cut?: number
  url?: string
}

/** Besten aktuellen Deal + Allzeit-Tiefstpreis zu einer Steam-AppID holen. */
export async function getItadPrices(appId: number): Promise<ItadPrices | null> {
  const key = getItadKey()
  if (!key) return null
  try {
    const gameId = await lookupGameId(key, appId)
    if (!gameId) return { best: null, historyLowCents: null }

    const res = await fetch(`${API}/games/prices/v3?key=${key}&country=DE&deals=false`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([gameId]),
      signal: AbortSignal.timeout(12000)
    })
    if (!res.ok) return { best: null, historyLowCents: null }
    const json = (await res.json()) as {
      id: string
      historyLow?: { all?: PriceAmount }
      deals?: DealEntry[]
    }[]
    const entry = json[0]
    if (!entry) return { best: null, historyLowCents: null }

    // Günstigsten aktuellen Deal heraussuchen.
    let best: ItadPrices['best'] = null
    for (const deal of entry.deals ?? []) {
      if (!deal.price || !deal.url) continue
      if (!best || deal.price.amountInt < best.priceCents) {
        best = {
          shop: deal.shop?.name ?? 'Shop',
          priceCents: deal.price.amountInt,
          cut: deal.cut ?? 0,
          url: deal.url
        }
      }
    }
    return { best, historyLowCents: entry.historyLow?.all?.amountInt ?? null }
  } catch {
    return { best: null, historyLowCents: null }
  }
}

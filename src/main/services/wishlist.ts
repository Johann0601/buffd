// Wunschliste mit Preisalarm: Steam-Spiele merken, Preise regelmäßig über
// die öffentliche Store-API prüfen (KEIN Key nötig) und Rabatte an die
// 🔔-Glocke melden. Die Preisprüfung läuft gebündelt in EINER Anfrage:
// appdetails erlaubt mehrere AppIDs, solange nur price_overview abgefragt wird.

import type { SteamSearchResult, WishlistAltPrice, WishlistItem } from '@shared/types'
import {
  addWishlistItem,
  listWishlist,
  updateWishlistAltPrice,
  updateWishlistMeta,
  updateWishlistPrice
} from '../db'
import { epicOfferPrice, searchEpicStore } from './epic/search'
import { steamIdentity } from './steam/webapi'

interface PriceOverview {
  final: number // Cent
  initial: number // Cent (regulär)
  discount_percent: number
}

// --- Namens-Abgleich für den Shop-Vergleich --------------------------------

/** Titel auf einen Vergleichskern reduzieren (Klein, ohne Editions-Zusätze/Sonderzeichen). */
function normTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/&/g, 'and')
    .replace(
      /\b(deluxe|ultimate|standard|premium|game of the year|goty|definitive|complete|gold|legendary|remastered|remake|edition)\b/g,
      ''
    )
    .replace(/[^a-z0-9]+/g, '')
}

/** Zwei Store-Titel gelten als dasselbe Spiel? (bewusst konservativ). */
function titlesMatch(a: string, b: string): boolean {
  const na = normTitle(a)
  const nb = normTitle(b)
  if (!na || !nb) return false
  if (na === nb) return true
  return na.length >= 5 && nb.length >= 5 && (na.includes(nb) || nb.includes(na))
}

/** Gleiches Spiel im Epic-Store suchen (für Steam-Einträge). */
async function epicAltPrice(name: string): Promise<WishlistAltPrice | null> {
  const r = await searchEpicStore(name)
  if (!r.ok) return null
  const hit = r.results.find((el) => titlesMatch(el.name, name))
  if (!hit) return null
  return {
    shop: 'epic',
    priceCents: hit.priceCents,
    originalCents: hit.originalCents,
    discountPct: hit.discountPct,
    storeUrl: hit.storeUrl
  }
}

/** Gleiches Spiel im Steam-Store suchen (für Epic-Einträge). */
async function steamAltPrice(name: string): Promise<WishlistAltPrice | null> {
  const results = await searchSteamStore(name)
  const hit = results.find((el) => titlesMatch(el.name, name))
  if (!hit) return null
  return {
    shop: 'steam',
    priceCents: hit.priceCents,
    originalCents: hit.originalCents,
    discountPct: hit.discountPct,
    storeUrl: hit.storeUrl
  }
}

/** Steam-Primärpreis EINES Spiels holen (undefined = Abruf scheiterte). */
async function fetchSteamPrice(appId: string): Promise<PriceOverview | null | undefined> {
  try {
    const res = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=DE&filters=price_overview`,
      { signal: AbortSignal.timeout(15000) }
    )
    if (!res.ok) return undefined
    const json = (await res.json()) as Record<
      string,
      { success: boolean; data?: { price_overview?: PriceOverview } }
    >
    const entry = json[appId]
    if (!entry?.success) return undefined
    return entry.data?.price_overview ?? null // null = gratis / nicht im Verkauf
  } catch {
    return undefined
  }
}

/**
 * Preis EINES Eintrags prüfen (Primärpreis + Preis im anderen Shop) — schnell,
 * für „gerade zur Wunschliste hinzugefügt". Die volle Liste prüft die 6-Stunden-
 * Routine bzw. der manuelle Knopf.
 */
export async function checkOneWishlistPrice(appId: string): Promise<WishlistItem[]> {
  const item = listWishlist().find((i) => i.appId === appId)
  if (!item) return listWishlist()
  try {
    if (item.shop === 'steam') {
      const p = await fetchSteamPrice(item.appId)
      if (p) updateWishlistPrice(item.appId, p.final, p.initial, p.discount_percent)
      else if (p === null) updateWishlistPrice(item.appId, null, null, 0)
      updateWishlistAltPrice(item.appId, await epicAltPrice(item.name))
    } else {
      const price = await epicOfferPrice(item.name, item.appId)
      if (price) {
        updateWishlistPrice(item.appId, price.priceCents, price.originalCents, price.discountPct)
      }
      updateWishlistAltPrice(item.appId, await steamAltPrice(item.name))
    }
  } catch {
    /* Preis bleibt vorerst unbekannt — die Routine holt ihn nach */
  }
  return listWishlist()
}

/** Preise aller Wunschlisten-Einträge prüfen und speichern (Steam + Epic). */
export async function checkWishlistPrices(): Promise<WishlistItem[]> {
  const items = listWishlist()
  if (items.length === 0) return []

  // Steam-Primärpreise: ALLE in EINER Anfrage (appdetails erlaubt das bei price_overview).
  const steamItems = items.filter((i) => i.shop === 'steam')
  if (steamItems.length > 0) {
    try {
      const ids = steamItems.map((i) => i.appId).join(',')
      const res = await fetch(
        `https://store.steampowered.com/api/appdetails?appids=${ids}&cc=DE&filters=price_overview`,
        { signal: AbortSignal.timeout(15000) }
      )
      if (res.ok) {
        const json = (await res.json()) as Record<
          string,
          { success: boolean; data?: { price_overview?: PriceOverview } }
        >
        for (const item of steamItems) {
          const entry = json[item.appId]
          if (!entry?.success) continue
          const p = entry.data?.price_overview
          // Kein price_overview = gratis oder nicht (mehr) im Verkauf.
          if (p) updateWishlistPrice(item.appId, p.final, p.initial, p.discount_percent)
          else updateWishlistPrice(item.appId, null, null, 0)
        }
      }
    } catch {
      /* offline o. ä. — alte Preise bleiben stehen */
    }
  }

  // Pro Eintrag: ggf. Epic-Primärpreis + Preis im jeweils ANDEREN Shop.
  // Epic-Aufrufe brauchen Abstand (Cloudflare-Bot-Schutz!) → sequenziell mit Pause.
  let epicCalls = 0
  for (const item of items) {
    try {
      if (item.shop === 'epic') {
        if (epicCalls++ > 0) await new Promise((r) => setTimeout(r, 1500))
        const price = await epicOfferPrice(item.name, item.appId)
        if (price) {
          updateWishlistPrice(item.appId, price.priceCents, price.originalCents, price.discountPct)
        }
        // Anderer Shop = Steam (günstig, kein Bot-Schutz).
        updateWishlistAltPrice(item.appId, await steamAltPrice(item.name))
      } else {
        // Steam-Primärpreis kam schon aus dem Bulk-Call oben.
        // Anderer Shop = Epic → Aufruf pacen.
        if (epicCalls++ > 0) await new Promise((r) => setTimeout(r, 1500))
        updateWishlistAltPrice(item.appId, await epicAltPrice(item.name))
      }
    } catch {
      /* einzelner Eintrag fehlgeschlagen — Rest läuft weiter */
    }
  }

  return listWishlist()
}

/** Name + Header-Bild eines Spiels aus der Store-API (filters=basic). */
async function fetchBasicInfo(
  appId: number
): Promise<{ name: string; headerImage: string | null } | null> {
  try {
    const res = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${appId}&filters=basic&l=german`,
      { signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) return null
    const json = (await res.json()) as Record<
      string,
      { success: boolean; data?: { name?: string; header_image?: string } }
    >
    const data = json[String(appId)]?.data
    if (!data?.name) return null
    return { name: data.name, headerImage: data.header_image ?? null }
  } catch {
    return null
  }
}

/**
 * Die ECHTE Steam-Wunschliste des lokalen Kontos übernehmen. Beide Endpunkte
 * sind öffentlich (kein Key nötig), solange die Wunschliste nicht privat ist:
 *   GetWishlist -> AppIDs, GetApps -> Namen dazu (eine Anfrage für alle).
 */
export async function importSteamWishlist(): Promise<{
  ok: boolean
  imported: number
  total: number
  error?: string
}> {
  const identity = steamIdentity()
  if (!identity) {
    return { ok: false, imported: 0, total: 0, error: 'Kein Steam-Konto auf diesem PC gefunden.' }
  }

  try {
    const res = await fetch(
      `https://api.steampowered.com/IWishlistService/GetWishlist/v1/?steamid=${identity.steamId}`,
      { signal: AbortSignal.timeout(15000) }
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = (await res.json()) as { response?: { items?: { appid: number }[] } }
    const appIds = (json.response?.items ?? []).map((i) => i.appid)
    if (appIds.length === 0) {
      return {
        ok: false,
        imported: 0,
        total: 0,
        error:
          'Keine Einträge gefunden. Ist deine Steam-Wunschliste leer — oder in den Privatsphäre-Einstellungen auf privat gestellt?'
      }
    }

    const existing = new Set(listWishlist().map((w) => w.appId))
    let imported = 0

    // Name + echtes Header-Bild pro Spiel holen (Bild-URLs lassen sich bei
    // neueren Spielen NICHT konstruieren — Steam hängt einen Hash in den Pfad).
    // Maximal 100 Stück, um Steams Ratenlimit nicht zu reizen.
    for (const id of appIds.slice(0, 100)) {
      const info = await fetchBasicInfo(id)
      if (existing.has(String(id))) {
        // Vorhandene Einträge nebenbei reparieren/auffrischen.
        if (info) updateWishlistMeta(String(id), info.name, info.headerImage)
      } else {
        addWishlistItem(
          String(id),
          info?.name ?? `Steam-App ${id}`,
          info?.headerImage ?? null,
          'steam',
          `https://store.steampowered.com/app/${id}/`
        )
        imported++
      }
    }
    if (imported > 0) await checkWishlistPrices() // direkt Preise zu den Neuen holen

    return { ok: true, imported, total: appIds.length }
  } catch (err) {
    return {
      ok: false,
      imported: 0,
      total: 0,
      error: String(err instanceof Error ? err.message : err)
    }
  }
}

/** Steam-Store-Suche für die Wunschliste (mehrere Treffer). */
export async function searchSteamStore(term: string): Promise<SteamSearchResult[]> {
  const cleaned = term.trim()
  if (cleaned.length < 2) return []
  try {
    const res = await fetch(
      `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(cleaned)}&l=german&cc=DE`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return []
    // tiny_image ist die ECHTE Bild-URL aus der API — selbst konstruieren
    // funktioniert bei neueren Spielen nicht (Hash im Pfad).
    const json = (await res.json()) as {
      items?: {
        id: number
        name: string
        tiny_image?: string
        price?: { initial?: number; final?: number } // Cent
      }[]
    }
    return (json.items ?? []).slice(0, 8).map((i) => {
      const final = i.price?.final ?? null
      const initial = i.price?.initial ?? null
      return {
        appId: String(i.id),
        name: i.name,
        coverUrl: i.tiny_image ?? null,
        priceCents: final,
        originalCents: initial,
        discountPct:
          final !== null && initial !== null && initial > 0 && final < initial
            ? Math.round((1 - final / initial) * 100)
            : 0,
        storeUrl: `https://store.steampowered.com/app/${i.id}/`
      }
    })
  } catch {
    return []
  }
}

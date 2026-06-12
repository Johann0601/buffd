// Epic-Store-Suche über die öffentliche GraphQL-Schnittstelle der Store-
// Webseite (store.epicgames.com/graphql, kein Login nötig). Achtung:
// Der Endpunkt steckt hinter Cloudflare-Bot-Schutz. Darum nutzen wir
// Electrons net.fetch (Chromes echter Netzwerk-Stack samt TLS-Verhalten)
// statt Nodes fetch — für Cloudflare sieht das wie ein Browser aus.
//
// Preis-Eigenheit: totalPrice.discount ist der RABATT-BETRAG in Cent,
// kein Prozentwert — die Prozente rechnen wir selbst aus.

import { net } from 'electron'
import type { EpicSearchResult } from '@shared/types'

const GRAPHQL_URL = 'https://store.epicgames.com/graphql'

const SEARCH_QUERY = `
query searchStoreQuery($keywords: String, $country: String!, $locale: String, $count: Int) {
  Catalog {
    searchStore(keywords: $keywords, country: $country, locale: $locale, count: $count,
                category: "games/edition/base|bundles/games|editors") {
      elements {
        title id namespace
        keyImages { type url }
        price(country: $country) { totalPrice { discountPrice originalPrice } }
        catalogNs { mappings(pageType: "productHome") { pageSlug } }
        productSlug
      }
    }
  }
}`

interface SearchElement {
  title: string
  id: string
  namespace: string
  keyImages?: { type: string; url: string }[]
  price?: { totalPrice?: { discountPrice?: number; originalPrice?: number } }
  catalogNs?: { mappings?: { pageSlug?: string }[] }
  productSlug?: string | null
}

// Hochformat-Bilder bevorzugen (passen zu unseren Karten/Zeilen).
const IMAGE_ORDER = ['OfferImageTall', 'DieselStoreFrontTall', 'Thumbnail', 'OfferImageWide']

function pickImage(images: { type: string; url: string }[] | undefined): string | null {
  for (const type of IMAGE_ORDER) {
    const hit = images?.find((i) => i.type === type)
    if (hit) return hit.url
  }
  return images?.[0]?.url ?? null
}

function storeUrlFor(el: SearchElement): string | null {
  const slug = el.catalogNs?.mappings?.[0]?.pageSlug ?? el.productSlug?.replace(/\/home$/, '')
  return slug ? `https://store.epicgames.com/de/p/${slug}` : null
}

function toResult(el: SearchElement): EpicSearchResult {
  const tp = el.price?.totalPrice
  const price = tp?.discountPrice ?? null
  const original = tp?.originalPrice ?? null
  const discountPct =
    price !== null && original !== null && original > 0 && price < original
      ? Math.round((1 - price / original) * 100)
      : 0
  return {
    id: `${el.namespace}:${el.id}`,
    name: el.title,
    coverUrl: pickImage(el.keyImages),
    priceCents: price,
    originalCents: original,
    discountPct,
    storeUrl: storeUrlFor(el)
  }
}

async function runSearch(keywords: string, count: number): Promise<SearchElement[]> {
  const res = await net.fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Browser-Header — ohne sie blockt Cloudflare deutlich schneller.
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    },
    body: JSON.stringify({
      query: SEARCH_QUERY,
      variables: { keywords, country: 'DE', locale: 'de', count }
    }),
    signal: AbortSignal.timeout(12000)
  })
  if (!res.ok) {
    throw new Error(
      res.status === 400 || res.status === 403
        ? 'Epic blockt gerade automatisierte Anfragen — bitte in einer Minute nochmal versuchen.'
        : `Epic antwortet nicht (HTTP ${res.status}).`
    )
  }
  const json = (await res.json()) as {
    data?: { Catalog?: { searchStore?: { elements?: SearchElement[] } } }
  }
  return json.data?.Catalog?.searchStore?.elements ?? []
}

/** Epic-Store nach Spielen durchsuchen. */
export async function searchEpicStore(
  term: string
): Promise<{ ok: true; results: EpicSearchResult[] } | { ok: false; error: string }> {
  const cleaned = term.trim()
  if (cleaned.length < 2) return { ok: true, results: [] }
  try {
    const elements = await runSearch(cleaned, 10)
    return { ok: true, results: elements.map(toResult) }
  } catch (err) {
    return { ok: false, error: String(err instanceof Error ? err.message : err) }
  }
}

/**
 * Aktuellen Preis EINES Wunschlisten-Eintrags prüfen: Suche nach dem Namen
 * und Treffer über namespace:offerId zuordnen (nutzt dieselbe, bewährte Abfrage).
 */
export async function epicOfferPrice(
  name: string,
  key: string
): Promise<{ priceCents: number | null; originalCents: number | null; discountPct: number } | null> {
  try {
    const elements = await runSearch(name, 10)
    const hit = elements.find((el) => `${el.namespace}:${el.id}` === key)
    if (!hit) return null
    const r = toResult(hit)
    return { priceCents: r.priceCents, originalCents: r.originalCents, discountPct: r.discountPct }
  } catch {
    return null
  }
}

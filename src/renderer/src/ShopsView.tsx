import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ShoppingCart,
  Star,
  Gift,
  Tag,
  TriangleAlert,
  Check,
  ExternalLink,
  X,
  Download,
  Search,
  ChevronDown
} from 'lucide-react'
import type {
  EpicFreeGame,
  EpicSearchResult,
  SteamOffer,
  SteamSearchResult,
  WishlistItem,
  WishlistShop
} from '@shared/types'
import { formatEuro } from './format'

// Shops: EINE gemeinsame Suchleiste durchsucht Steam & Epic gleichzeitig
// (mit Filtern), zeigt bei Treffern in beiden Shops den günstigeren Preis.
// Die Wunschliste klappt als Popup unter dem Knopf aus. Darunter bleiben die
// Highlights (Epic-Gratisspiele + Steam-Angebote) als Karussell stehen.

// --- Hilfen -------------------------------------------------------------------

function formatCents(cents: number | null, currency: string): string {
  if (cents === null) return ''
  const symbol = currency === 'EUR' ? '€' : currency
  return `${(cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 })} ${symbol}`
}

const shopLabel = (s: WishlistShop): string => (s === 'epic' ? 'Epic' : 'Steam')

/** Titel auf einen Vergleichskern reduzieren (für „gibt's das in beiden Shops?"). */
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

function titlesMatch(a: string, b: string): boolean {
  const na = normTitle(a)
  const nb = normTitle(b)
  if (!na || !nb) return false
  if (na === nb) return true
  return na.length >= 5 && nb.length >= 5 && (na.includes(nb) || nb.includes(na))
}

/** Preis-Rang fürs Vergleichen (null/unbekannt zählt als „teuer"). */
const priceRank = (c: number | null): number => (c === null ? Infinity : c)

/** Höchstwert des Preis-Schiebereglers in Euro — dort = „80+" = kein Limit. */
const PRICE_MAX = 80

/** Kleines Zeilen-Cover mit Buchstaben-Rückfall, falls das Bild nicht lädt. */
function RowCover({ url, name }: { url: string | null; name: string }): JSX.Element {
  const [failed, setFailed] = useState(false)
  if (!url || failed) {
    return <span className="shop-row-cover fallback">{name.charAt(0)}</span>
  }
  return (
    <img className="shop-row-cover" src={url} alt="" loading="lazy" onError={() => setFailed(true)} />
  )
}

function priceText(priceCents: number | null, originalCents: number | null, discountPct: number): string {
  if (priceCents === null) return ''
  if (priceCents === 0) return 'Gratis'
  if (discountPct > 0) {
    return `${formatEuro(priceCents)} statt ${originalCents !== null ? formatEuro(originalCents) : '—'}`
  }
  return formatEuro(priceCents)
}

// --- Such-Treffer (shop-übergreifend zusammengeführt) -------------------------

interface StoreRow {
  key: string // == WishlistItem.appId
  shop: WishlistShop
  name: string
  coverUrl: string | null
  priceCents: number | null
  originalCents: number | null
  discountPct: number
  storeUrl: string | null
}

/** Ein zusammengeführter Treffer: der günstigere Shop + ggf. der andere. */
interface MergedRow {
  best: StoreRow
  other: StoreRow | null
}

function steamRow(r: SteamSearchResult): StoreRow {
  return { key: r.appId, shop: 'steam', ...r }
}
function offerToRow(o: SteamOffer): StoreRow {
  return {
    key: String(o.appId),
    shop: 'steam',
    name: o.name,
    coverUrl: o.coverUrl,
    priceCents: o.finalPriceCents,
    originalCents: o.originalPriceCents,
    discountPct: o.discountPercent,
    storeUrl: o.storeUrl
  }
}
function epicRow(r: EpicSearchResult): StoreRow {
  return {
    key: r.id,
    shop: 'epic',
    name: r.name,
    coverUrl: r.coverUrl,
    priceCents: r.priceCents,
    originalCents: r.originalCents,
    discountPct: r.discountPct,
    storeUrl: r.storeUrl
  }
}

/** Treffer aus beiden Shops zusammenführen: gleicher Titel in beiden = eine Zeile. */
function mergeRows(rows: StoreRow[]): MergedRow[] {
  const merged: MergedRow[] = []
  for (const row of rows) {
    const hit = merged.find((m) => m.best.shop !== row.shop && titlesMatch(m.best.name, row.name) && !m.other)
    if (hit) {
      if (priceRank(row.priceCents) < priceRank(hit.best.priceCents)) {
        hit.other = hit.best
        hit.best = row
      } else {
        hit.other = row
      }
    } else {
      merged.push({ best: row, other: null })
    }
  }
  return merged
}

// --- Wunschliste: günstigeren Preis über beide Shops ermitteln ----------------

interface BestPrice {
  shop: WishlistShop
  priceCents: number | null
  originalCents: number | null
  discountPct: number
  storeUrl: string | null
  other: { shop: WishlistShop; priceCents: number | null } | null
}

function bestWishlistPrice(w: WishlistItem): BestPrice {
  const primary: BestPrice = {
    shop: w.shop,
    priceCents: w.priceCents,
    originalCents: w.originalCents,
    discountPct: w.discountPct,
    storeUrl: w.storeUrl,
    other: null
  }
  // Anderer Shop nur, wenn dort wirklich ein Preis bekannt ist.
  if (!w.alt || w.alt.priceCents === null) return primary
  const altIsCheaper = priceRank(w.alt.priceCents) < priceRank(w.priceCents)
  if (altIsCheaper) {
    return {
      shop: w.alt.shop,
      priceCents: w.alt.priceCents,
      originalCents: w.alt.originalCents,
      discountPct: w.alt.discountPct,
      storeUrl: w.alt.storeUrl,
      other: { shop: w.shop, priceCents: w.priceCents }
    }
  }
  return { ...primary, other: { shop: w.alt.shop, priceCents: w.alt.priceCents } }
}

// --- Hauptansicht -------------------------------------------------------------

type ShopChoice = 'both' | 'steam' | 'epic'

function ShopsView(): JSX.Element {
  // Highlights aus allen Shops für die Übersicht.
  const [freeGames, setFreeGames] = useState<EpicFreeGame[]>([])
  const [epicOffers, setEpicOffers] = useState<EpicSearchResult[]>([])
  const [offers, setOffers] = useState<SteamOffer[]>([])

  // Wunschliste (Popup).
  const [wishlist, setWishlist] = useState<WishlistItem[]>([])
  const [wishOpen, setWishOpen] = useState(false)

  useEffect(() => {
    window.api
      .getEpicFreeGames()
      .then((g) => setFreeGames(g.filter((f) => f.status === 'gratis')))
      .catch(() => {})
    window.api.getEpicOffers().then(setEpicOffers).catch(() => {})
    window.api
      .getSteamOffers()
      .then((o) => setOffers(o.slice(0, 12)))
      .catch(() => {})
    window.api.getWishlist().then(setWishlist).catch(() => {})
  }, [])

  const wishedIds = useMemo(() => new Set(wishlist.map((w) => w.appId)), [wishlist])

  // Epic-Angebote, die nicht ohnehin schon als Gratisspiel laufen.
  const epicOffersToShow = useMemo(
    () => epicOffers.filter((o) => !freeGames.some((f) => titlesMatch(f.title, o.name))),
    [epicOffers, freeGames]
  )

  const addToWishlist = async (r: StoreRow): Promise<void> => {
    setWishlist(
      await window.api.addToWishlist({
        appId: r.key,
        name: r.name,
        coverUrl: r.coverUrl,
        shop: r.shop,
        storeUrl: r.storeUrl
      })
    )
  }

  const toggleSteamOfferWish = async (o: SteamOffer): Promise<void> => {
    const appId = String(o.appId)
    setWishlist(
      wishedIds.has(appId)
        ? await window.api.removeFromWishlist(appId)
        : await window.api.addToWishlist({
            appId,
            name: o.name,
            coverUrl: o.coverUrl,
            shop: 'steam',
            storeUrl: o.storeUrl
          })
    )
  }

  const toggleEpicOfferWish = async (o: EpicSearchResult): Promise<void> => {
    setWishlist(
      wishedIds.has(o.id)
        ? await window.api.removeFromWishlist(o.id)
        : await window.api.addToWishlist({
            appId: o.id,
            name: o.name,
            coverUrl: o.coverUrl,
            shop: 'epic',
            storeUrl: o.storeUrl
          })
    )
  }

  return (
    <div className="app">
      <header className="topbar shop-topbar">
        <div className="brand">
          <h1 className="h2-icon">
            <ShoppingCart size={22} /> Shops
          </h1>
          <span className="subtitle">Steam & Epic gemeinsam durchsuchen</span>
        </div>
        <div className="wishlist-anchor">
          <button
            className={`btn ${wishOpen ? 'active' : ''}`}
            onClick={() => setWishOpen((v) => !v)}
          >
            <Star size={15} className="wl-star" /> Wunschliste
            {wishlist.length > 0 && <span className="wishlist-count">{wishlist.length}</span>}
            <ChevronDown size={14} className={`wishlist-chevron ${wishOpen ? 'open' : ''}`} />
          </button>
          {wishOpen && (
            <WishlistDropdown
              wishlist={wishlist}
              onChanged={setWishlist}
              onClose={() => setWishOpen(false)}
            />
          )}
        </div>
      </header>

      <main className="content">
        <StoreSearch wishedIds={wishedIds} onAdd={addToWishlist} />

        {/* Highlights aus allen Shops */}
        {(freeGames.length > 0 || epicOffersToShow.length > 0) && (
          <>
            <h2 className="section-title icon-line" style={{ marginTop: 30 }}>
              <Gift size={18} /> Angebote bei Epic
            </h2>
            <div className="offer-row">
              {/* Gratisspiele stehen immer am Anfang. */}
              {freeGames.map((g) => (
                <button
                  key={g.title}
                  className="offer-card epic-card"
                  data-tip="Im Epic Store ansehen"
                  onClick={() => g.storeUrl && window.open(g.storeUrl, '_blank')}
                >
                  <div className="offer-cover tall">
                    {g.coverUrl ? <img src={g.coverUrl} alt={g.title} loading="lazy" /> : <span />}
                    <span className="offer-badge free">GRATIS</span>
                  </div>
                  <div className="offer-info">
                    <div className="offer-name">{g.title}</div>
                    <div className="offer-meta">
                      {g.originalPrice ? `statt ${g.originalPrice}` : 'kostenlos'}
                    </div>
                  </div>
                </button>
              ))}
              {/* Danach die regulären Epic-Angebote. */}
              {epicOffersToShow.map((o) => (
                <div
                  key={o.id}
                  className="offer-card epic-card"
                  data-tip="Im Epic Store ansehen"
                  onClick={() => o.storeUrl && window.open(o.storeUrl, '_blank')}
                >
                  <div className="offer-cover tall">
                    {o.coverUrl ? <img src={o.coverUrl} alt={o.name} loading="lazy" /> : <span />}
                    {o.discountPct > 0 && (
                      <span className="offer-badge discount">-{o.discountPct}%</span>
                    )}
                    <button
                      className={`wish-btn ${wishedIds.has(o.id) ? 'active' : ''}`}
                      data-tip={
                        wishedIds.has(o.id)
                          ? 'Von der Wunschliste entfernen'
                          : 'Auf die Wunschliste (mit Preisalarm)'
                      }
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleEpicOfferWish(o)
                      }}
                    >
                      <Star size={16} fill={wishedIds.has(o.id) ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                  <div className="offer-info">
                    <div className="offer-name">{o.name}</div>
                    <div className="offer-meta">
                      {o.originalCents !== null && (
                        <>
                          <s>{formatEuro(o.originalCents)}</s>{' '}
                        </>
                      )}
                      <b>{o.priceCents !== null ? formatEuro(o.priceCents) : ''}</b>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {offers.length > 0 && (
          <>
            <h2 className="section-title icon-line" style={{ marginTop: 18 }}>
              <Tag size={18} /> Steam-Angebote
            </h2>
            <div className="offer-row">
              {offers.map((o) => (
                <div
                  key={o.appId}
                  className="offer-card steam-card"
                  data-tip="Im Steam Store ansehen"
                  onClick={() => window.open(o.storeUrl, '_blank')}
                >
                  <div className="offer-cover">
                    {o.coverUrl ? <img src={o.coverUrl} alt={o.name} loading="lazy" /> : <span />}
                    <span className="offer-badge discount">-{o.discountPercent}%</span>
                    <button
                      className={`wish-btn ${wishedIds.has(String(o.appId)) ? 'active' : ''}`}
                      data-tip={
                        wishedIds.has(String(o.appId))
                          ? 'Von der Wunschliste entfernen'
                          : 'Auf die Wunschliste (mit Preisalarm)'
                      }
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleSteamOfferWish(o)
                      }}
                    >
                      <Star
                        size={16}
                        fill={wishedIds.has(String(o.appId)) ? 'currentColor' : 'none'}
                      />
                    </button>
                  </div>
                  <div className="offer-info">
                    <div className="offer-name">{o.name}</div>
                    <div className="offer-meta">
                      <s>{formatCents(o.originalPriceCents, o.currency)}</s>{' '}
                      <b>{formatCents(o.finalPriceCents, o.currency)}</b>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

// --- Gemeinsame Such-Leiste mit Filtern ---------------------------------------

function StoreSearch({
  wishedIds,
  onAdd
}: {
  wishedIds: Set<string>
  onAdd: (r: StoreRow) => Promise<void>
}): JSX.Element {
  const [search, setSearch] = useState('')
  const [merged, setMerged] = useState<MergedRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)

  // Filter
  const [shop, setShop] = useState<ShopChoice>('both')
  const [onlyDeals, setOnlyDeals] = useState(false)
  const [onlyFree, setOnlyFree] = useState(false)
  const [maxPrice, setMaxPrice] = useState(PRICE_MAX) // Euro; PRICE_MAX (80) = „80+" = kein Limit

  const runSearch = async (): Promise<void> => {
    setSearching(true)
    setError(null)
    try {
      const wantSteam = shop !== 'epic'
      const wantEpic = shop !== 'steam'

      // Ohne Suchbegriff: die Steam-Hauptangebote zeigen (zum Stöbern/Filtern).
      if (search.trim().length < 2) {
        const offers = wantSteam
          ? await window.api.getSteamOffers().catch(() => [] as SteamOffer[])
          : []
        if (!wantSteam) {
          setError('Für „Stöbern" ohne Suchbegriff bitte Steam (oder „Beide") wählen.')
        }
        setMerged(mergeRows(offers.map(offerToRow)))
        return
      }

      const [steam, epic] = await Promise.all([
        wantSteam
          ? window.api.searchSteamStore(search).catch(() => [] as SteamSearchResult[])
          : Promise.resolve([] as SteamSearchResult[]),
        wantEpic
          ? window.api.searchEpicStore(search)
          : Promise.resolve({ ok: true as const, results: [] as EpicSearchResult[] })
      ])
      const rows: StoreRow[] = [
        ...steam.map(steamRow),
        ...(epic.ok ? epic.results.map(epicRow) : [])
      ]
      if (wantEpic && !epic.ok) setError(epic.error)
      setMerged(mergeRows(rows))
    } finally {
      setSearching(false)
    }
  }

  // Filter auf die zusammengeführten Treffer anwenden (Preis = günstigerer Shop).
  const shown = useMemo(() => {
    if (!merged) return null
    const maxCents = maxPrice < PRICE_MAX ? maxPrice * 100 : null // PRICE_MAX = kein Limit
    return merged.filter((m) => {
      const p = m.best.priceCents
      if (onlyFree && p !== 0) return false
      if (onlyDeals && m.best.discountPct === 0 && (m.other?.discountPct ?? 0) === 0) return false
      if (maxCents !== null) {
        if (p === null || p > maxCents) return false
      }
      return true
    })
  }, [merged, onlyFree, onlyDeals, maxPrice])

  const filtersActive = onlyDeals || onlyFree || maxPrice < PRICE_MAX || shop !== 'both'

  // Suche zurücksetzen: Eingabe, Treffer und Filter leeren — nichts wird mehr angezeigt.
  const reset = (): void => {
    setSearch('')
    setMerged(null)
    setError(null)
    setShop('both')
    setOnlyDeals(false)
    setOnlyFree(false)
    setMaxPrice(PRICE_MAX)
  }
  const canReset = merged !== null || search.trim() !== '' || filtersActive

  return (
    <section className="store-search">
      <div className="store-search-bar">
        <Search size={18} className="store-search-icon" />
        <input
          type="text"
          className="store-search-input"
          placeholder="Spiel in Steam & Epic suchen … (leer lassen = Steam-Angebote stöbern)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') runSearch()
          }}
        />
        <button className="btn primary" onClick={runSearch} disabled={searching}>
          {searching ? 'Suche …' : 'Suchen'}
        </button>
        {canReset && (
          <button className="btn" onClick={reset} data-tip="Suche & Filter zurücksetzen">
            <X size={15} /> Zurücksetzen
          </button>
        )}
      </div>

      <div className="store-filters">
        <div className="store-filter-shops">
          {(['both', 'steam', 'epic'] as ShopChoice[]).map((s) => (
            <button
              key={s}
              className={`chip ${shop === s ? 'active' : ''}`}
              onClick={() => setShop(s)}
            >
              {s === 'both' ? 'Beide' : s === 'steam' ? 'Steam' : 'Epic'}
            </button>
          ))}
        </div>
        <button
          className={`chip ${onlyDeals ? 'active' : ''}`}
          onClick={() => setOnlyDeals((v) => !v)}
        >
          Nur Angebote
        </button>
        <button className={`chip ${onlyFree ? 'active' : ''}`} onClick={() => setOnlyFree((v) => !v)}>
          Nur Gratis
        </button>
        <label className="store-filter-price">
          <span className="store-filter-price-text">max</span>
          <span className="store-filter-price-field">
            <input
              type="number"
              className="store-filter-price-input"
              min="0"
              max={PRICE_MAX}
              step="1"
              value={maxPrice}
              data-tip={`Höchstpreis in € — ${PRICE_MAX} bedeutet: kein Limit`}
              onChange={(e) => {
                const n = Math.round(Number(e.target.value))
                if (Number.isNaN(n)) return
                setMaxPrice(Math.min(PRICE_MAX, Math.max(0, n)))
              }}
            />
            <span className="store-filter-price-euro">€</span>
          </span>
          <input
            type="range"
            className="price-slider"
            min="0"
            max={PRICE_MAX}
            step="1"
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
          />
        </label>
      </div>

      {error && (
        <p className="hint icon-line">
          <TriangleAlert size={14} /> {error}
        </p>
      )}

      {shown && (
        <div className="shop-library" style={{ marginTop: 6 }}>
          {shown.length === 0 && (
            <p className="hint">
              {merged && merged.length > 0 && filtersActive
                ? 'Keine Treffer mit diesen Filtern.'
                : 'Nichts gefunden.'}
            </p>
          )}
          {shown.map((m) => {
            const r = m.best
            const onWishlist = wishedIds.has(r.key) || (m.other ? wishedIds.has(m.other.key) : false)
            return (
              <div
                key={r.key}
                className="shop-row clickable"
                data-tip={r.storeUrl ? 'Im Store ansehen' : r.name}
                onClick={() => r.storeUrl && window.open(r.storeUrl, '_blank')}
              >
                <RowCover url={r.coverUrl} name={r.name} />
                <div className="shop-row-main">
                  <div className="shop-row-title">
                    {r.name} <span className="shop-tag">{shopLabel(r.shop)}</span>
                  </div>
                  <div className="shop-row-meta">
                    {priceText(r.priceCents, r.originalCents, r.discountPct) || 'Preis unbekannt'}
                    {m.other && (
                      <span className="shop-row-alt">
                        · auch bei {shopLabel(m.other.shop)}
                        {m.other.priceCents !== null ? ` für ${formatEuro(m.other.priceCents)}` : ''}
                      </span>
                    )}
                  </div>
                </div>
                {r.discountPct > 0 && <span className="offer-badge discount">-{r.discountPct}%</span>}
                {onWishlist ? (
                  <span className="shop-installed icon-line">
                    <Check size={13} /> Wunschliste
                  </span>
                ) : (
                  <button
                    className="btn small icon-only"
                    data-tip="Auf die Wunschliste (mit Preisalarm)"
                    onClick={(e) => {
                      e.stopPropagation()
                      onAdd(r)
                    }}
                  >
                    <Star size={15} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// --- Wunschliste-Popup (klappt unter dem Knopf aus) ---------------------------

function WishlistDropdown({
  wishlist,
  onChanged,
  onClose
}: {
  wishlist: WishlistItem[]
  onChanged: (items: WishlistItem[]) => void
  onClose: () => void
}): JSX.Element {
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Außerhalb klicken schließt das Popup.
  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (!panelRef.current) return
      const anchor = panelRef.current.closest('.wishlist-anchor')
      if (anchor && !anchor.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  const importFromSteam = async (): Promise<void> => {
    setImporting(true)
    setImportMsg(null)
    try {
      const result = await window.api.importSteamWishlist()
      if (result.ok) {
        onChanged(await window.api.getWishlist())
        setImportMsg({
          kind: 'ok',
          text:
            result.imported > 0
              ? `${result.imported} von ${result.total} Einträgen übernommen.`
              : `Alle ${result.total} Einträge waren schon da.`
        })
      } else {
        setImportMsg({ kind: 'error', text: result.error ?? 'Import fehlgeschlagen.' })
      }
    } finally {
      setImporting(false)
    }
  }

  const remove = async (appId: string): Promise<void> => {
    onChanged(await window.api.removeFromWishlist(appId))
  }

  return (
    <div className="wishlist-dropdown" ref={panelRef}>
      <div className="wishlist-dropdown-head">
        <span className="wishlist-dropdown-title icon-line">
          <Star size={16} className="wl-star" /> Wunschliste
          {wishlist.length > 0 && <span className="subtitle">{wishlist.length} Spiele</span>}
        </span>
        <div className="icon-line">
          <button
            className="btn small"
            onClick={importFromSteam}
            disabled={importing}
            data-tip="Übernimmt die Wunschliste deines Steam-Kontos (muss öffentlich sein)"
          >
            {importing ? (
              'Importiere …'
            ) : (
              <>
                <Download size={14} /> Steam übernehmen
              </>
            )}
          </button>
          <button className="btn small icon-only" data-tip="Schließen" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
      </div>

      {importMsg && <div className={`account-message ${importMsg.kind}`}>{importMsg.text}</div>}

      {wishlist.length === 0 ? (
        <p className="hint" style={{ margin: '8px 4px' }}>
          Noch leer. Such oben ein Spiel und klick auf den Stern, oder übernimm deine
          Steam-Wunschliste. Die App prüft alle 6 Stunden den Preis in beiden Shops und meldet
          Rabatte über die Glocke.
        </p>
      ) : (
        <div className="wishlist-dropdown-list">
          {wishlist.map((w) => {
            const best = bestWishlistPrice(w)
            return (
              <div key={w.appId} className="shop-row">
                <RowCover url={w.coverUrl} name={w.name} />
                <div className="shop-row-main">
                  <div className="shop-row-title">
                    {w.name} <span className="shop-tag">{shopLabel(best.shop)}</span>
                  </div>
                  <div className="shop-row-meta">
                    {best.priceCents === null
                      ? 'Noch kein Preis — evtl. nicht erschienen (oder gratis)'
                      : best.discountPct > 0
                        ? `Im Angebot: ${priceText(best.priceCents, best.originalCents, best.discountPct)}`
                        : best.priceCents === 0
                          ? 'Gratis'
                          : `Aktuell ${formatEuro(best.priceCents)}`}
                    {best.other && best.other.priceCents !== null && (
                      <span className="shop-row-alt">
                        · {shopLabel(best.other.shop)} {formatEuro(best.other.priceCents)}
                      </span>
                    )}
                  </div>
                </div>
                {best.discountPct > 0 && (
                  <span className="offer-badge discount">-{best.discountPct}%</span>
                )}
                <button
                  className="btn small icon-only"
                  data-tip={`Im ${shopLabel(best.shop)}-Store ansehen`}
                  onClick={() =>
                    window.open(
                      best.storeUrl ?? `https://store.steampowered.com/app/${w.appId}/`,
                      '_blank'
                    )
                  }
                >
                  <ExternalLink size={15} />
                </button>
                <button
                  className="btn small icon-only"
                  data-tip="Von der Wunschliste entfernen"
                  onClick={() => remove(w.appId)}
                >
                  <X size={15} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ShopsView

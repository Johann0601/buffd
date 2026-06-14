// Öffentliche Steam-Store-Suche: Spielname -> Steam-AppID.
// Wird doppelt genutzt: für Online-Cover UND um Nicht-Steam-Spielen
// (Battle.net, RSI, …) Store-Infos/News zuzuordnen, wenn das Spiel
// auch auf Steam gelistet ist.

/** Entfernt Marken-Symbole (®, ™, ©) und Mehrfach-Leerzeichen aus einem Namen. */
export function cleanGameName(name: string): string {
  return name
    .replace(/[®™©]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Sucht die AppID zu einem Spielnamen; null, wenn kein plausibler Treffer. */
export async function steamSearchAppId(name: string): Promise<number | null> {
  const cleaned = cleanGameName(name)
  try {
    const res = await fetch(
      `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(cleaned)}&l=german&cc=DE`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return null
    const json = (await res.json()) as { items?: { id: number; name: string }[] }
    const hit = json.items?.[0]
    if (!hit) return null
    // Nur akzeptieren, wenn der Treffer wirklich nach dem Spiel klingt.
    const a = cleanGameName(hit.name).toLowerCase()
    const b = cleaned.toLowerCase()
    if (!a.includes(b) && !b.includes(a)) return null
    return hit.id
  } catch {
    return null
  }
}

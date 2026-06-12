/** Sekunden -> "12 h 34 min" bzw. "34 min" bzw. "—". */
export function formatPlaytime(totalSec: number): string {
  if (!totalSec || totalSec <= 0) return '—'
  const totalMin = Math.floor(totalSec / 60)
  const hours = Math.floor(totalMin / 60)
  const minutes = totalMin % 60
  if (hours === 0) return `${minutes} min`
  return `${hours} h ${minutes} min`
}

/** Bytes -> "120,4 GB" / "850 MB" — für Spiel-Ordnergrößen. */
export function formatGameSize(bytes: number): string {
  const gib = bytes / 1024 ** 3
  if (gib >= 100) return `${Math.round(gib)} GB`
  if (gib >= 1) return `${gib.toFixed(1).replace('.', ',')} GB`
  const mib = bytes / 1024 ** 2
  if (mib >= 1) return `${Math.round(mib)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** Unix-Sekunden -> lesbares Datum (deutsch), oder "nie". */
export function formatLastPlayed(unixSec: number | null): string {
  if (!unixSec) return 'nie'
  return new Date(unixSec * 1000).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

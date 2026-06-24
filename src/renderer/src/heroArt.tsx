import { useEffect, useMemo, useState } from 'react'
import type { GameCard } from '@shared/types'

/**
 * Wiederverwendbare Hero-/Banner-Bausteine für die Querformat-Karten (Startseite
 * + Bibliothek): deterministischer Farbverlauf, SteamGridDB-„Hero"-Bilder und der
 * gemeinsam getaktete Crossfade. Bewusst ohne JSX-Layout — nur die Mechanik, damit
 * sowohl die Startseite als auch die Bibliothek dieselbe Bildlogik teilen.
 */

/** Deterministischer Farbverlauf aus einem Spielnamen (gleicher Name = gleiche Farbe). */
export function gradientFor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const hue = h % 360
  const hue2 = (hue + 38) % 360
  return `linear-gradient(135deg, hsl(${hue} 52% 34%), hsl(${hue2} 58% 19%))`
}

/** Breites Steam-Header-Bild (460×215) als Querformat-Fallback, falls kein Hero vorliegt. */
export function landscapeArt(game: GameCard): string | null {
  if (game.platform === 'steam' && game.platformId) {
    return `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.platformId}/header.jpg`
  }
  return null
}

/**
 * Querformat-Bilder. Priorität: SteamGridDB-„Heroes" (bis zu 3, quellenübergreifend)
 * → Steam-Header → keins (dann zeigt die Karte Farbverlauf + Anfangsbuchstaben).
 */
export function artUrls(game: GameCard, heroUrls?: string[] | null): string[] {
  if (heroUrls && heroUrls.length > 0) return heroUrls
  const steam = landscapeArt(game)
  return steam ? [steam] : []
}

// Gemeinsamer Takt für ALLE Karten: ein einziger Timer treibt sämtliche
// RotatingArt-Instanzen, damit sie exakt gleichzeitig überblenden.
let sharedTick = 0
const tickSubscribers = new Set<() => void>()
let tickTimer: ReturnType<typeof setInterval> | null = null
function ensureTicker(): void {
  if (tickTimer) return
  tickTimer = setInterval(() => {
    sharedTick++
    tickSubscribers.forEach((fn) => fn())
  }, 7000) // alle 7 s gemeinsam wechseln
}
function useSharedTick(): number {
  const [, force] = useState(0)
  useEffect(() => {
    const fn = (): void => force((n) => n + 1)
    tickSubscribers.add(fn)
    ensureTicker()
    return () => {
      tickSubscribers.delete(fn)
      if (tickSubscribers.size === 0 && tickTimer) {
        clearInterval(tickTimer)
        tickTimer = null
      }
    }
  }, [])
  return sharedTick
}

/**
 * Querformat-Artwork als Hintergrund mit weichem Crossfade. Liegen mehrere Bilder
 * vor (Top-3-Heroes), blenden ALLE Karten im gemeinsamen 7-s-Takt gleichzeitig um.
 * Der Farbverlauf liegt als Fallback darunter (greift, falls ein Bild nicht lädt).
 */
export function RotatingArt({ urls, seed }: { urls: string[]; seed: string }): JSX.Element {
  const tick = useSharedTick()
  const idx = urls.length > 1 ? tick % urls.length : 0
  return (
    <div className="rot-art" style={{ backgroundImage: gradientFor(seed) }}>
      {urls.map((u, i) => (
        <div
          key={u}
          className="art-layer"
          style={{ backgroundImage: `url("${u}")`, opacity: i === idx ? 1 : 0 }}
        />
      ))}
    </div>
  )
}

/**
 * Lädt (und cacht) die SteamGridDB-„Hero"-Banner für die übergebenen Spiele und
 * gibt sie als Map `"platform:platformId" -> string[]` zurück. Bereits geladene
 * Spiele werden nicht erneut abgefragt.
 */
export function useGameHeroes(targets: GameCard[]): Map<string, string[]> {
  const [heroes, setHeroes] = useState<Map<string, string[]>>(new Map())
  // Stabiler Schlüssel, damit der Effekt nur bei echter Änderung der Zielmenge feuert.
  const key = useMemo(() => targets.map((g) => `${g.platform}:${g.platformId}`).join('|'), [targets])
  useEffect(() => {
    for (const g of targets) {
      const k = `${g.platform}:${g.platformId}`
      if (heroes.has(k)) continue
      window.api
        .getGameHero({ platform: g.platform, platformId: g.platformId, name: g.name })
        .then((urls) => {
          setHeroes((m) => {
            const next = new Map(m)
            next.set(k, urls)
            return next
          })
        })
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return heroes
}

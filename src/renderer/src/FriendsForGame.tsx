import { useEffect, useState } from 'react'
import { User } from 'lucide-react'
import type { FriendsForGameResult, GameRef } from '@shared/types'
import { formatPlaytime } from './format'

// Zeigt, welche Steam-Freunde ein bestimmtes Spiel besitzen und wie viel Zeit
// sie darin verbracht haben. Bei vielen Freunden mehrspaltig (CSS-Grid).
// Rendert nichts, wenn kein Freund das Spiel hat (oder kein Steam-Key).
function FriendsForGame({ gameRef }: { gameRef: GameRef }): JSX.Element | null {
  const [result, setResult] = useState<FriendsForGameResult | null>(null)

  useEffect(() => {
    setResult(null)
    let cancelled = false
    const run = async (): Promise<void> => {
      // Steam-AppID: bei Steam-Spielen direkt, sonst per Namenssuche zuordnen.
      let appId = gameRef.platform === 'steam' ? Number(gameRef.platformId) || null : null
      if (!appId) {
        try {
          const d = await window.api.getGameDetails(gameRef)
          appId = d.appId ?? null
        } catch {
          /* keine Zuordnung möglich */
        }
      }
      if (!appId || cancelled) return
      try {
        const r = await window.api.getFriendsForGame(appId)
        if (!cancelled) setResult(r)
      } catch {
        /* ignorieren */
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [gameRef.platform, gameRef.platformId, gameRef.name])

  if (!result || !result.ok || result.friends.length === 0) return null

  return (
    <section className="detail-section fog-section">
      <h3 className="section-title">Freunde mit diesem Spiel ({result.friends.length})</h3>
      <div className="fog-grid">
        {result.friends.map((f) => (
          <div key={f.steamId} className="fog-item" title={f.personaName}>
            {f.avatarUrl ? (
              <img className="fog-avatar" src={f.avatarUrl} alt="" loading="lazy" />
            ) : (
              <span className="fog-avatar fog-avatar-fallback">
                <User size={18} />
              </span>
            )}
            <span className="fog-name">{f.personaName}</span>
            <span className="fog-time">
              {f.playtimeSec > 0 ? formatPlaytime(f.playtimeSec) : 'noch nicht gespielt'}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

export default FriendsForGame

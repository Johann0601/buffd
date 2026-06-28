import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  HardDrive,
  RefreshCw,
  Hourglass,
  Sparkles,
  Trash2,
  Info,
  Lightbulb
} from 'lucide-react'
import type { GameStorageInfo } from '@shared/types'
import { formatGameSize, formatLastPlayed } from './format'
import { platformLabel } from './platforms'
import { uninstallActionFor } from './uninstallAction'

// Ab dieser Größe + Inaktivität wird ein Spiel als Aufräum-Kandidat markiert.
const CLEANUP_MIN_BYTES = 10 * 1024 ** 3 // 10 GB
const CLEANUP_IDLE_SEC = 90 * 24 * 3600 // 90 Tage

/**
 * Speicher verwalten: listet alle installierten Spiele nach Größe und schlägt
 * vor, welche man löschen könnte (groß + lange nicht mehr gespielt).
 * Die eigentliche Größen-Analyse läuft im Hauptprozess (storage.ts) und meldet
 * jedes fertige Spiel einzeln zurück.
 */
function StorageView({
  onBack,
  embedded
}: {
  onBack?: () => void
  embedded?: boolean
}): JSX.Element {
  const [games, setGames] = useState<GameStorageInfo[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  // Hinweis nach Klick auf 🗑 bei Nicht-Steam-Spielen ("im Launcher deinstallieren").
  const [uninstallNotice, setUninstallNotice] = useState<{ gameId: number; text: string } | null>(
    null
  )

  const uninstall = (g: GameStorageInfo): void => {
    const action = uninstallActionFor(g.platform, g.platformId)
    if (!action) return
    action.run()
    if (action.hint) setUninstallNotice({ gameId: g.gameId, text: action.hint })
  }

  useEffect(() => {
    window.api.getGameStorage().then(setGames).catch(() => {})
    // Während der Analyse trudeln die Ergebnisse einzeln ein.
    return window.api.onStorageProgress((info) => {
      setGames((prev) => {
        const next = prev.map((g) => (g.gameId === info.gameId ? info : g))
        return next.sort((a, b) => (b.sizeBytes ?? -1) - (a.sizeBytes ?? -1))
      })
    })
  }, [])

  const analyze = async (): Promise<void> => {
    setAnalyzing(true)
    try {
      setGames(await window.api.analyzeGameStorage())
    } finally {
      setAnalyzing(false)
    }
  }

  const known = games.filter((g) => g.sizeBytes !== null)
  const totalBytes = known.reduce((sum, g) => sum + (g.sizeBytes ?? 0), 0)
  const maxBytes = known.length > 0 ? Math.max(...known.map((g) => g.sizeBytes ?? 0)) : 0
  const now = Math.floor(Date.now() / 1000)

  const isCleanup = (g: GameStorageInfo): boolean => {
    const idle = g.lastPlayed === null || now - g.lastPlayed > CLEANUP_IDLE_SEC
    return idle && (g.sizeBytes ?? 0) >= CLEANUP_MIN_BYTES
  }
  const cleanupGames = known.filter(isCleanup)
  const cleanupBytes = cleanupGames.reduce((sum, g) => sum + (g.sizeBytes ?? 0), 0)

  return (
    <div className={embedded ? 'set-sub' : 'app'}>
      <header className={embedded ? 'topbar topbar-embedded' : 'topbar'}>
        {onBack && (
          <button className="btn" onClick={onBack}>
            <ArrowLeft size={16} /> Zurück
          </button>
        )}
        <div className="brand">
          <h1 className="h2-icon">
            <HardDrive size={22} /> Speicher verwalten
          </h1>
          <span className="subtitle">
            {known.length > 0
              ? `${known.length} Spiele · zusammen ${formatGameSize(totalBytes)}`
              : 'Speicherbelegung der Spiele'}
          </span>
        </div>
        <button className="btn" onClick={analyze} disabled={analyzing}>
          {analyzing ? (
            'Berechne …'
          ) : (
            <>
              <RefreshCw size={15} /> {known.length > 0 ? 'Neu berechnen' : 'Größen berechnen'}
            </>
          )}
        </button>
      </header>

      <main className="content">
        {games.length === 0 && (
          <div className="empty">Keine installierten Spiele mit Ordnerpfad gefunden.</div>
        )}

        {known.length === 0 && games.length > 0 && !analyzing && (
          <p className="hint">
            Klicke oben auf „Größen berechnen" — die App durchläuft dann einmalig alle Spielordner
            (das kann bei großen Spielen ein paar Minuten dauern). Danach ist das Ergebnis
            gespeichert.
          </p>
        )}
        {analyzing && (
          <p className="hint icon-line">
            <Hourglass size={14} /> Berechne Ordnergrößen … die Liste füllt sich Spiel für Spiel.
          </p>
        )}

        {/* Aufräum-Vorschläge ganz oben hervorgehoben. */}
        {cleanupGames.length > 0 && (
          <section className="cleanup-box">
            <div className="cleanup-box-head">
              <span className="cleanup-box-title icon-line">
                <Sparkles size={17} /> Aufräum-Vorschläge
              </span>
              <span className="cleanup-box-sub">
                {cleanupGames.length} {cleanupGames.length === 1 ? 'Spiel' : 'Spiele'} seit über 3
                Monaten nicht gespielt · würde <b>{formatGameSize(cleanupBytes)}</b> freigeben
              </span>
            </div>
            <div className="cleanup-list">
              {cleanupGames.map((g) => (
                <div key={g.gameId} className="cleanup-row">
                  <span className="cleanup-row-name">{g.name}</span>
                  <span className="cleanup-row-meta">
                    zuletzt: {formatLastPlayed(g.lastPlayed)}
                  </span>
                  <span className="cleanup-row-size">{formatGameSize(g.sizeBytes ?? 0)}</span>
                  {uninstallActionFor(g.platform, g.platformId) && (
                    <button
                      className="btn small"
                      data-tip={
                        g.platform === 'steam'
                          ? 'Deinstallieren (öffnet Steams Bestätigungs-Dialog)'
                          : 'Deinstallieren (öffnet den Launcher)'
                      }
                      onClick={() => uninstall(g)}
                    >
                      <Trash2 size={14} /> Deinstallieren
                    </button>
                  )}
                  {uninstallNotice?.gameId === g.gameId && (
                    <div className="storage-cleanup-tip icon-line">
                      <Info size={13} /> {uninstallNotice.text}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Vollständige Liste aller Spiele nach Größe. */}
        {games.length > 0 && (
          <>
            <h2 className="section-title" style={{ marginTop: cleanupGames.length > 0 ? 26 : 0 }}>
              Alle Spiele
            </h2>
            <div className="storage-game-list">
              {games.map((g) => {
                const cleanupTip = isCleanup(g)
                const pct =
                  maxBytes > 0 && g.sizeBytes ? Math.max(2, (g.sizeBytes / maxBytes) * 100) : 0
                return (
                  <div key={g.gameId} className="storage-game-row">
                    <div className="storage-game-head">
                      <span className="storage-game-name">{g.name}</span>
                      <span className="storage-game-meta">
                        {platformLabel(g.platform)} · {g.installDir.charAt(0).toUpperCase()}:
                        {' · zuletzt gespielt: '}
                        {formatLastPlayed(g.lastPlayed)}
                      </span>
                      <span className="storage-game-size">
                        {g.sizeBytes !== null ? formatGameSize(g.sizeBytes) : '—'}
                      </span>
                      {uninstallActionFor(g.platform, g.platformId) && (
                        <button
                          className="uninstall-btn"
                          data-tip={
                            g.platform === 'steam'
                              ? 'Deinstallieren (öffnet Steams Bestätigungs-Dialog)'
                              : 'Deinstallieren (öffnet den Launcher)'
                          }
                          onClick={() => uninstall(g)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    {g.sizeBytes !== null && (
                      <div className="storage-track slim">
                        <div className="storage-fill" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                    {cleanupTip && g.sizeBytes !== null && (
                      <div className="storage-cleanup-tip icon-line">
                        <Lightbulb size={13} /> Seit über 3 Monaten nicht gespielt —
                        Deinstallieren würde <b>{formatGameSize(g.sizeBytes)}</b> freigeben.
                      </div>
                    )}
                    {uninstallNotice?.gameId === g.gameId && (
                      <div className="storage-cleanup-tip icon-line">
                        <Info size={13} /> {uninstallNotice.text}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default StorageView

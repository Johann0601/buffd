import { useEffect, useState, type ReactNode } from 'react'
import { CircleArrowUp, RefreshCw, Check } from 'lucide-react'
import type { GameCard, UpdateEvent } from '@shared/types'
import { formatLastPlayed } from './format'
import { updateActionFor } from './updateAction'

function UpdatesView({ tabs }: { tabs?: ReactNode }): JSX.Element {
  const [games, setGames] = useState<GameCard[]>([])
  const [history, setHistory] = useState<UpdateEvent[]>([])
  const [loading, setLoading] = useState(true)

  const load = async (): Promise<void> => {
    setLoading(true)
    try {
      // Frisch scannen, damit der Update-Status aktuell ist (liest nur lokale Dateien).
      const result = await window.api.scanLibrary()
      setGames(result.games)
      setHistory(await window.api.getUpdateHistory())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const pending = games.filter((g) => g.kind === 'game' && g.updatePending)

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1 className="h2-icon">
            <CircleArrowUp size={22} /> Updates
          </h1>
          <span className="subtitle">
            {pending.length === 0 ? 'alles aktuell' : `${pending.length} ausstehend`}
          </span>
        </div>
        {tabs}
        <button className="btn" onClick={load} disabled={loading}>
          {loading ? (
            'Prüfe …'
          ) : (
            <>
              <RefreshCw size={15} /> Jetzt prüfen
            </>
          )}
        </button>
      </header>

      <main className="content">
        <div className="banner info">
          Die App erkennt ausstehende Updates für <strong>Steam</strong> (lokale
          Steam-Dateien) und <strong>Battle.net</strong> (Abgleich mit Blizzards
          Versions-Server) und führt eine eigene Historie. Installiert wird ausschließlich
          über den jeweiligen Launcher. Für Epic-, Ubisoft-, Riot-, RSI- und Xbox-Spiele ist
          keine zuverlässige Update-Erkennung möglich.
        </div>

        <h2 className="section-title">Ausstehende Updates</h2>
        {pending.length === 0 ? (
          <div className="empty-inline icon-line">
            <Check size={15} /> Alle Spiele sind auf dem neuesten Stand.
          </div>
        ) : (
          <div className="device-list">
            {pending.map((g) => {
              const action = updateActionFor(g)
              return (
                <div key={g.id} className="device-row">
                  <div className="device-row-top">
                    <div className="device-main">
                      <div className="device-name">
                        {g.name} <span className="tag update">Update verfügbar</span>
                      </div>
                      <div className="device-vendor">
                        {g.manifestLastUpdated
                          ? `Zuletzt aktualisiert: ${formatLastPlayed(g.manifestLastUpdated)}`
                          : g.platform === 'battlenet'
                            ? 'Battle.net-Spiel'
                            : ''}
                      </div>
                    </div>
                    {action && (
                      <button className="btn small" onClick={action.run}>
                        {action.label}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <h2 className="section-title" style={{ marginTop: 28 }}>
          Historie
        </h2>
        {history.length === 0 ? (
          <div className="empty-inline">
            Noch keine Einträge — sie entstehen, sobald Updates erkannt oder installiert werden.
          </div>
        ) : (
          <div className="history-list">
            {history.map((e) => (
              <div key={e.id} className="history-row">
                <span className={`history-type icon-line ${e.type}`}>
                  {e.type === 'installiert' ? (
                    <>
                      <Check size={13} /> installiert
                    </>
                  ) : (
                    <>
                      <CircleArrowUp size={13} /> erkannt
                    </>
                  )}
                </span>
                <span className="history-game">{e.gameName}</span>
                <span className="history-build">
                  {e.type === 'installiert' && e.oldBuild && e.newBuild
                    ? `Build ${e.oldBuild} → ${e.newBuild}`
                    : e.oldBuild
                      ? `Build ${e.oldBuild}`
                      : ''}
                </span>
                <span className="history-date">
                  {new Date(e.createdAt * 1000).toLocaleString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default UpdatesView

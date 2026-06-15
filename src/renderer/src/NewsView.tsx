import { useEffect, useState } from 'react'
import { Newspaper, RefreshCw } from 'lucide-react'
import type { LibraryNewsResult } from '@shared/types'

// News-Feed (A7): neueste News/Patchnotes aller installierten Steam-Spiele,
// gebündelt und nach Datum sortiert. Klick öffnet die Meldung im Browser.

function formatNewsDate(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

function NewsView(): JSX.Element {
  const [data, setData] = useState<LibraryNewsResult | null>(null)
  const [loading, setLoading] = useState(true)

  const load = (force = false): void => {
    setLoading(true)
    window.api
      .getLibraryNews(force)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => load(), [])

  const items = data?.items ?? []

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1 className="h2-icon">
            <Newspaper size={22} /> News
          </h1>
          <span className="subtitle">
            {loading ? 'lädt …' : `${items.length} Meldungen aus deiner Bibliothek`}
          </span>
        </div>
        <button className="btn" onClick={() => load(true)} disabled={loading}>
          {loading ? (
            'Lädt …'
          ) : (
            <>
              <RefreshCw size={15} /> Aktualisieren
            </>
          )}
        </button>
      </header>

      <main className="content">
        {loading && items.length === 0 && (
          <div className="empty">Lade Neuigkeiten aus deinen Spielen …</div>
        )}

        {!loading && items.length === 0 && (
          <div className="empty">
            Aktuell keine Neuigkeiten gefunden. Der Feed sammelt News deiner installierten
            Steam-Spiele — bei anderen Plattformen (z. B. Epic) gibt es hier noch nichts.
          </div>
        )}

        {items.length > 0 && (
          <div className="news-feed">
            {items.map((n) => (
              <a
                key={n.url}
                className="news-card"
                href={n.url}
                target="_blank"
                rel="noreferrer"
                title={n.title}
              >
                <div className="news-card-cover">
                  {n.coverUrl ? (
                    <img src={n.coverUrl} alt="" loading="lazy" />
                  ) : (
                    <span className="news-card-noart">{n.gameName.charAt(0)}</span>
                  )}
                </div>
                <div className="news-card-body">
                  <div className="news-card-head">
                    <span className="news-card-game">{n.gameName}</span>
                    <span className="news-card-date">{formatNewsDate(n.date)}</span>
                  </div>
                  <div className="news-card-title">{n.title}</div>
                  {n.excerpt && <div className="news-card-excerpt">{n.excerpt}</div>}
                  <div className="news-card-source">{n.feedLabel}</div>
                </div>
              </a>
            ))}
          </div>
        )}

        {data && (
          <p className="hint">
            Zeigt die neuesten News/Patchnotes deiner installierten Steam-Spiele (
            {data.scannedGames} geprüft) in einem Feed. Klick auf eine Meldung öffnet sie im
            Browser.
          </p>
        )}
      </main>
    </div>
  )
}

export default NewsView

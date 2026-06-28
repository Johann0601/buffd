import { useCallback, useEffect, useRef, useState } from 'react'
import { Music, SkipBack, SkipForward, Play, Pause } from 'lucide-react'
import type { SpotifyState, SpotifyStatus } from '@shared/types'

// Spotify-Musik-Widget: zeigt den laufenden Song (Cover, Titel, Interpret) und
// erlaubt Steuern (Zurück/Play-Pause/Weiter). Pollt den Status, solange ein
// Spotify-Konto verbunden ist.

function SpotifyWidget(): JSX.Element {
  const [status, setStatus] = useState<SpotifyStatus | null>(null)
  const [state, setState] = useState<SpotifyState | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const refreshState = useCallback(async (): Promise<void> => {
    try {
      setState(await window.api.getSpotifyState())
    } catch {
      /* ignorieren */
    }
  }, [])

  useEffect(() => {
    window.api.getSpotifyStatus().then(setStatus).catch(() => {})
  }, [])

  // Polling nur bei verbundenem Konto.
  useEffect(() => {
    if (!status?.connected) return
    refreshState()
    timer.current = setInterval(refreshState, 5000)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [status?.connected, refreshState])

  const connect = async (): Promise<void> => {
    setBusy(true)
    setNote('Anmeldung im Browser läuft …')
    try {
      const res = await window.api.spotifyLogin()
      if (res.ok) {
        setStatus(res.status)
        setNote(null)
      } else {
        setNote(res.error)
      }
    } finally {
      setBusy(false)
    }
  }

  const control = async (action: 'play' | 'pause' | 'next' | 'previous'): Promise<void> => {
    const res = await window.api.spotifyControl(action)
    if (!res.ok) setNote(res.needsPremium ? 'Steuern erfordert Spotify Premium.' : res.error ?? null)
    else setNote(null)
    setTimeout(refreshState, 400) // kurz warten, dann frischen Zustand holen
  }

  // Nicht eingerichtet (keine Client-ID) bzw. nicht verbunden.
  if (status && !status.connected) {
    return (
      <>
        <span className="stat-card-icon">
          <Music size={26} />
        </span>
        <span className="stat-card-title">Spotify</span>
        {status.configured ? (
          <>
            <span className="stat-card-info">Verbinde dein Konto, um Musik zu steuern.</span>
            <button
              className="btn small primary"
              style={{ marginTop: 8 }}
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation()
                connect()
              }}
            >
              {busy ? 'Verbinde …' : 'Mit Spotify verbinden'}
            </button>
          </>
        ) : (
          <span className="stat-card-info">
            Einrichten unter Einstellungen → Konten (eigene Spotify-Client-ID).
          </span>
        )}
        {note && <span className="spotify-note">{note}</span>}
      </>
    )
  }

  const playing = state?.isPlaying ?? false

  return (
    <>
      <div className="spotify-now">
        <div className="spotify-cover">
          {state?.albumArt ? (
            <img src={state.albumArt} alt="" />
          ) : (
            <span className="spotify-cover-empty">
              <Music size={22} />
            </span>
          )}
        </div>
        <div className="spotify-meta">
          <span className="spotify-label">Spotify</span>
          {state?.active && state.track ? (
            <>
              <span className="spotify-track" data-tip={state.track}>
                {state.track}
              </span>
              <span className="spotify-artist" data-tip={state.artists ?? ''}>
                {state.artists}
              </span>
            </>
          ) : (
            <span className="spotify-artist">Gerade läuft nichts</span>
          )}
        </div>
      </div>

      <div className="spotify-controls">
        <button
          className="spotify-btn"
          data-tip="Zurück"
          onClick={(e) => {
            e.stopPropagation()
            control('previous')
          }}
        >
          <SkipBack size={18} />
        </button>
        <button
          className="spotify-btn big"
          data-tip={playing ? 'Pause' : 'Wiedergabe'}
          onClick={(e) => {
            e.stopPropagation()
            control(playing ? 'pause' : 'play')
          }}
        >
          {playing ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <button
          className="spotify-btn"
          data-tip="Weiter"
          onClick={(e) => {
            e.stopPropagation()
            control('next')
          }}
        >
          <SkipForward size={18} />
        </button>
      </div>
      {note && <span className="spotify-note">{note}</span>}
    </>
  )
}

export default SpotifyWidget

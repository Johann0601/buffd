import { useEffect, useState } from 'react'
import type {
  EpicAccountStatus,
  ItadStatus,
  SgdbStatus,
  SpotifyStatus,
  SteamKeyStatus
} from '@shared/types'

// Konten-Bereich: externe Konten mit der App VERBINDEN (kein eigenes
// App-Login). Aktuell: Epic Games — lesend für Spielzeiten & Bibliothek.
function AccountsView({ onBack }: { onBack?: () => void }): JSX.Element {
  return (
    <div className="app">
      <header className="topbar">
        {onBack && (
          <button className="btn" onClick={onBack}>
            ← Zurück
          </button>
        )}
        <div className="brand">
          <h1>👤 Konten</h1>
          <span className="subtitle">Externe Konten & API-Keys für Zusatzfunktionen</span>
        </div>
      </header>

      <main className="content">
        <EpicAccountCard />
        <SpotifyAccountCard />
        <SteamKeyCard />
        <SgdbKeyCard />
        <ItadKeyCard />
        <p className="hint">
          Die App liest nur Daten (Spielzeiten, Bibliothek, Erfolge, Preise) — sie verändert nie
          etwas an deinen Konten. Passwörter gibst du ausschließlich auf den offiziellen Seiten
          ein; die App bekommt sie nie zu sehen. Zugangsdaten und alle API-Keys werden mit
          Windows-Verschlüsselung nur auf diesem PC gespeichert.
        </p>
      </main>
    </div>
  )
}

function EpicAccountCard(): JSX.Element {
  const [status, setStatus] = useState<EpicAccountStatus | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    window.api.getEpicStatus().then(setStatus).catch(() => {})
  }, [])

  const connect = async (): Promise<void> => {
    if (!code.trim()) return
    setBusy(true)
    setMessage(null)
    const result = await window.api.epicLogin(code)
    setBusy(false)
    if (result.ok) {
      setStatus(result.status)
      setCode('')
      setMessage({ kind: 'ok', text: 'Verbunden! Spielzeiten werden jetzt abgeglichen …' })
      const sync = await window.api.syncEpicPlaytime()
      setMessage(
        sync.ok
          ? {
              kind: 'ok',
              text:
                sync.updatedGames > 0
                  ? `Fertig — Spielzeit von ${sync.updatedGames} Spiel(en) von Epic übernommen.`
                  : 'Fertig — deine Spielzeiten waren schon aktuell.'
            }
          : { kind: 'error', text: sync.error ?? 'Spielzeit-Abgleich fehlgeschlagen.' }
      )
    } else {
      setMessage({ kind: 'error', text: result.error })
    }
  }

  const syncNow = async (): Promise<void> => {
    setBusy(true)
    setMessage(null)
    const sync = await window.api.syncEpicPlaytime()
    setBusy(false)
    setMessage(
      sync.ok
        ? {
            kind: 'ok',
            text:
              sync.updatedGames > 0
                ? `Spielzeit von ${sync.updatedGames} Spiel(en) aktualisiert.`
                : 'Alles aktuell — keine Änderungen.'
          }
        : { kind: 'error', text: sync.error ?? 'Abgleich fehlgeschlagen.' }
    )
  }

  const disconnect = async (): Promise<void> => {
    setStatus(await window.api.epicLogout())
    setMessage({ kind: 'ok', text: 'Epic-Konto getrennt. Getrackte Spielzeiten bleiben erhalten.' })
  }

  return (
    <section className="account-card">
      <div className="account-head">
        <span className="account-icon">🛒</span>
        <div>
          <div className="account-title">Epic Games</div>
          <div className="account-state">
            {status === null
              ? 'lade …'
              : status.connected
                ? `✓ Verbunden als ${status.displayName}`
                : 'Nicht verbunden'}
          </div>
        </div>
      </div>

      {status?.connected ? (
        <div className="account-actions">
          <button className="btn" onClick={syncNow} disabled={busy}>
            {busy ? 'Gleiche ab …' : '↻ Spielzeit jetzt abgleichen'}
          </button>
          <button className="btn danger" onClick={disconnect} disabled={busy}>
            Trennen
          </button>
        </div>
      ) : (
        status !== null && (
          <div className="account-connect">
            <ol className="account-steps">
              <li>
                Klicke auf <b>„Epic-Login öffnen"</b> und melde dich im Browser bei Epic an (ganz
                normal, mit 2FA falls aktiv).
              </li>
              <li>
                Danach zeigt dir Epic eine Textseite mit deinem Code — kopiere den Wert hinter{' '}
                <code>"authorizationCode"</code> (32 Zeichen).
              </li>
              <li>Füge den Code hier ein und klicke auf „Verbinden".</li>
            </ol>
            <div className="account-actions">
              <button className="btn" onClick={() => window.api.openEpicLogin()}>
                🌐 Epic-Login öffnen
              </button>
              <input
                type="text"
                className="account-code-input"
                placeholder="authorizationCode hier einfügen"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') connect()
                }}
              />
              <button className="btn primary" onClick={connect} disabled={busy || !code.trim()}>
                {busy ? 'Verbinde …' : 'Verbinden'}
              </button>
            </div>
          </div>
        )
      )}

      {message && <div className={`account-message ${message.kind}`}>{message.text}</div>}

      {status?.connected && (
        <p className="account-note">
          Die Epic-Spielzeit wird beim App-Start automatisch übernommen. Dein selbst getracktes
          Spielen zählt wie gewohnt obendrauf — nichts wird doppelt gezählt.
        </p>
      )}
    </section>
  )
}

// Spotify: persönliche Anbindung fürs Musik-Widget. Jeder hinterlegt seine
// EIGENE Client-ID (aus einer selbst angelegten Spotify-App) und meldet sich
// mit dem eigenen Konto an — nichts hängt an einem fremden Konto.
function SpotifyAccountCard(): JSX.Element {
  const [status, setStatus] = useState<SpotifyStatus | null>(null)
  const [clientId, setClientId] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    window.api.getSpotifyStatus().then(setStatus).catch(() => {})
  }, [])

  const saveId = async (): Promise<void> => {
    if (!clientId.trim()) return
    setBusy(true)
    setMessage(null)
    const s = await window.api.setSpotifyClientId(clientId.trim())
    setBusy(false)
    setStatus(s)
    setClientId('')
    setMessage({ kind: 'ok', text: 'Client-ID gespeichert — jetzt unten „Mit Spotify verbinden".' })
  }

  const connect = async (): Promise<void> => {
    setBusy(true)
    setMessage({ kind: 'ok', text: 'Anmeldung im Browser läuft …' })
    const res = await window.api.spotifyLogin()
    setBusy(false)
    if (res.ok) {
      setStatus(res.status)
      setMessage({ kind: 'ok', text: 'Verbunden! Das Spotify-Widget steuert jetzt deine Musik.' })
    } else {
      setMessage({ kind: 'error', text: res.error })
    }
  }

  const disconnect = async (): Promise<void> => {
    setStatus(await window.api.spotifyLogout())
    setMessage({ kind: 'ok', text: 'Spotify getrennt.' })
  }

  const removeId = async (): Promise<void> => {
    setStatus(await window.api.setSpotifyClientId(null))
    setMessage({ kind: 'ok', text: 'Client-ID entfernt.' })
  }

  return (
    <section className="account-card">
      <div className="account-head">
        <span className="account-icon">🎵</span>
        <div>
          <div className="account-title">Spotify (Musik-Widget)</div>
          <div className="account-state">
            {status === null
              ? 'lade …'
              : status.connected
                ? `✓ Verbunden als ${status.displayName}`
                : status.configured
                  ? 'Client-ID hinterlegt — noch nicht verbunden'
                  : 'Nicht eingerichtet'}
          </div>
        </div>
      </div>

      {status?.connected ? (
        <div className="account-actions">
          <button className="btn danger" onClick={disconnect} disabled={busy}>
            Trennen
          </button>
          <button className="btn" onClick={removeId} disabled={busy}>
            Client-ID entfernen
          </button>
        </div>
      ) : (
        status !== null && (
          <div className="account-connect">
            <p className="account-note">
              Fürs Spotify-Widget brauchst du eine eigene (kostenlose) Spotify-App. Steuern erfordert
              Spotify <b>Premium</b>. Es wird ausschließlich <b>dein</b> Konto verbunden.
            </p>
            <ol className="account-steps">
              <li>
                Öffne{' '}
                <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">
                  developer.spotify.com/dashboard
                </a>{' '}
                und klicke auf „Create app".
              </li>
              <li>
                Trage als <b>Redirect URI</b> exakt <code>http://127.0.0.1:8888/callback</code> ein,
                wähle „Web API" und speichere.
              </li>
              <li>
                Unter „Settings" findest du die <b>Client ID</b> — kopiere sie und füge sie hier ein.
              </li>
            </ol>
            <div className="account-actions">
              <input
                type="text"
                className="account-code-input"
                placeholder="Spotify Client ID einfügen"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveId()
                }}
              />
              <button className="btn primary" onClick={saveId} disabled={busy || !clientId.trim()}>
                {busy ? '…' : 'Client-ID speichern'}
              </button>
            </div>
            {status.configured && (
              <div className="account-actions" style={{ marginTop: 8 }}>
                <button className="btn primary" onClick={connect} disabled={busy}>
                  🎵 Mit Spotify verbinden
                </button>
                <button className="btn" onClick={removeId} disabled={busy}>
                  Client-ID entfernen
                </button>
              </div>
            )}
          </div>
        )
      )}

      {message && <div className={`account-message ${message.kind}`}>{message.text}</div>}
    </section>
  )
}

// Steam-Web-API-Key: kostenlos, schaltet die Erfolge auf den Detailseiten frei.
// Die SteamID kommt automatisch aus der lokalen Steam-Installation.
function SteamKeyCard(): JSX.Element {
  const [status, setStatus] = useState<SteamKeyStatus | null>(null)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    window.api.getSteamKeyStatus().then(setStatus).catch(() => {})
  }, [])

  const save = async (): Promise<void> => {
    if (!key.trim()) return
    setBusy(true)
    setMessage(null)
    const result = await window.api.setSteamKey(key)
    setBusy(false)
    if (result.ok) {
      setStatus(result.status)
      setKey('')
      setMessage({ kind: 'ok', text: 'Key gespeichert — die Erfolge erscheinen jetzt auf den Spiel-Detailseiten.' })
    } else {
      setMessage({ kind: 'error', text: result.error })
    }
  }

  const remove = async (): Promise<void> => {
    setStatus(await window.api.clearSteamKey())
    setMessage({ kind: 'ok', text: 'Key entfernt.' })
  }

  return (
    <section className="account-card">
      <div className="account-head">
        <span className="account-icon">🏆</span>
        <div>
          <div className="account-title">Steam-Web-API-Key (optional)</div>
          <div className="account-state">
            {status === null
              ? 'lade …'
              : status.connected
                ? `✓ Aktiv${status.personaName ? ` für ${status.personaName}` : ''}`
                : 'Kein Key hinterlegt (optional)'}
          </div>
        </div>
      </div>

      {status?.connected ? (
        <div className="account-actions">
          <button className="btn danger" onClick={remove} disabled={busy}>
            Key entfernen
          </button>
        </div>
      ) : (
        status !== null && (
          <div className="account-connect">
            <p className="account-note">
              Nur nötig für persönliche Extras: deine freigeschalteten Steam-Erfolge auf den
              Detailseiten und den vollständigen Besitz-Katalog (nicht installierte Steam-Spiele).
              Cover und Preise laufen ohne diesen Key.
            </p>
            <ol className="account-steps">
              <li>
                Öffne{' '}
                <a href="https://steamcommunity.com/dev/apikey" target="_blank" rel="noreferrer">
                  steamcommunity.com/dev/apikey
                </a>{' '}
                und melde dich an.
              </li>
              <li>
                Als „Domainname" kannst du einfach <code>localhost</code> eintragen — der Key ist
                kostenlos und sofort gültig.
              </li>
              <li>Kopiere den Key (32 Zeichen) und füge ihn hier ein.</li>
            </ol>
            <div className="account-actions">
              <input
                type="text"
                className="account-code-input"
                placeholder="Steam-Web-API-Key einfügen"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') save()
                }}
              />
              <button className="btn primary" onClick={save} disabled={busy || !key.trim()}>
                {busy ? 'Prüfe …' : 'Speichern'}
              </button>
            </div>
          </div>
        )
      )}

      {message && <div className={`account-message ${message.kind}`}>{message.text}</div>}

      {status?.connected && (
        <p className="account-note">
          Damit zeigen die Spiel-Detailseiten deine freigeschalteten Erfolge. Wichtig: In Steam
          müssen unter Profil → Privatsphäre die „Spieldetails" auf öffentlich stehen.
        </p>
      )}
    </section>
  )
}

// SteamGridDB-Key: kostenlos, liefert echte Box-Art-Cover für Spiele aller
// Plattformen (ersetzt die Wikipedia-Logos).
function SgdbKeyCard(): JSX.Element {
  const [status, setStatus] = useState<SgdbStatus | null>(null)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    window.api.getSgdbStatus().then(setStatus).catch(() => {})
  }, [])

  const save = async (): Promise<void> => {
    if (!key.trim()) return
    setBusy(true)
    setMessage(null)
    const result = await window.api.setSgdbKey(key)
    setBusy(false)
    if (result.ok) {
      setStatus({ connected: true, builtin: false })
      setKey('')
      setMessage({
        kind: 'ok',
        text:
          result.upgradedCovers > 0
            ? `Key gespeichert — ${result.upgradedCovers} Cover wurden direkt durch Box-Art ersetzt.`
            : 'Key gespeichert — neue Spiele bekommen ab jetzt Cover von SteamGridDB.'
      })
    } else {
      setMessage({ kind: 'error', text: result.error })
    }
  }

  const remove = async (): Promise<void> => {
    setStatus(await window.api.clearSgdbKey())
    setMessage({ kind: 'ok', text: 'Key entfernt. Vorhandene Cover bleiben erhalten.' })
  }

  return (
    <section className="account-card">
      <div className="account-head">
        <span className="account-icon">🖼️</span>
        <div>
          <div className="account-title">SteamGridDB (bessere Cover)</div>
          <div className="account-state">
            {status === null
              ? 'lade …'
              : status.builtin
                ? '✓ Aktiv (eingebaut — kein eigener Key nötig)'
                : status.connected
                  ? '✓ Aktiv (eigener Key)'
                  : 'Kein Key hinterlegt'}
          </div>
        </div>
      </div>

      {status && status.connected && !status.builtin ? (
        <div className="account-actions">
          <button className="btn danger" onClick={remove} disabled={busy}>
            Key entfernen
          </button>
        </div>
      ) : (
        status !== null && (
          <div className="account-connect">
            {status.builtin && (
              <p className="account-note">
                Cover funktionieren bereits über den eingebauten Schlüssel — du musst hier nichts
                tun. Optional kannst du einen eigenen Key hinterlegen.
              </p>
            )}
            <ol className="account-steps">
              <li>
                Öffne{' '}
                <a
                  href="https://www.steamgriddb.com/profile/preferences/api"
                  target="_blank"
                  rel="noreferrer"
                >
                  steamgriddb.com → Preferences → API
                </a>{' '}
                und melde dich mit deinem Steam-Konto an.
              </li>
              <li>Klicke auf „Generate API Key" und kopiere den Key.</li>
              <li>Hier einfügen — fertige Logos werden direkt durch echte Box-Art ersetzt.</li>
            </ol>
            <div className="account-actions">
              <input
                type="text"
                className="account-code-input"
                placeholder="SteamGridDB-API-Key einfügen"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') save()
                }}
              />
              <button className="btn primary" onClick={save} disabled={busy || !key.trim()}>
                {busy ? 'Prüfe …' : 'Speichern'}
              </button>
            </div>
          </div>
        )
      )}

      {message && <div className={`account-message ${message.kind}`}>{message.text}</div>}
    </section>
  )
}

// IsThereAnyDeal-Key: kostenlos, schaltet Preisvergleich über alle Shops und
// historische Tiefstpreise auf den Spiel-Detailseiten frei.
function ItadKeyCard(): JSX.Element {
  const [status, setStatus] = useState<ItadStatus | null>(null)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    window.api.getItadStatus().then(setStatus).catch(() => {})
  }, [])

  const save = async (): Promise<void> => {
    if (!key.trim()) return
    setBusy(true)
    setMessage(null)
    const result = await window.api.setItadKey(key)
    setBusy(false)
    if (result.ok) {
      setStatus({ connected: true, builtin: false })
      setKey('')
      setMessage({
        kind: 'ok',
        text: 'Key gespeichert — Detailseiten zeigen jetzt Bestpreis und historischen Tiefstpreis.'
      })
    } else {
      setMessage({ kind: 'error', text: result.error })
    }
  }

  const remove = async (): Promise<void> => {
    setStatus(await window.api.clearItadKey())
    setMessage({ kind: 'ok', text: 'Key entfernt.' })
  }

  return (
    <section className="account-card">
      <div className="account-head">
        <span className="account-icon">💶</span>
        <div>
          <div className="account-title">IsThereAnyDeal (Preisvergleich)</div>
          <div className="account-state">
            {status === null
              ? 'lade …'
              : status.builtin
                ? '✓ Aktiv (eingebaut — kein eigener Key nötig)'
                : status.connected
                  ? '✓ Aktiv (eigener Key)'
                  : 'Kein Key hinterlegt (optional)'}
          </div>
        </div>
      </div>

      {status && status.connected && !status.builtin ? (
        <div className="account-actions">
          <button className="btn danger" onClick={remove} disabled={busy}>
            Key entfernen
          </button>
        </div>
      ) : (
        status !== null && (
          <div className="account-connect">
            {status.builtin && (
              <p className="account-note">
                Preise sind bereits über den eingebauten Schlüssel aktiv — optional kannst du einen
                eigenen Key hinterlegen.
              </p>
            )}
            <ol className="account-steps">
              <li>
                Öffne{' '}
                <a href="https://isthereanydeal.com/dev/apps/" target="_blank" rel="noreferrer">
                  isthereanydeal.com/dev/apps
                </a>{' '}
                und melde dich an (kostenloses Konto).
              </li>
              <li>Registriere eine neue App (Name egal, z. B. „buffd") und kopiere den API-Key.</li>
              <li>Hier einfügen — fertig.</li>
            </ol>
            <div className="account-actions">
              <input
                type="text"
                className="account-code-input"
                placeholder="IsThereAnyDeal-API-Key einfügen"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') save()
                }}
              />
              <button className="btn primary" onClick={save} disabled={busy || !key.trim()}>
                {busy ? 'Prüfe …' : 'Speichern'}
              </button>
            </div>
          </div>
        )
      )}

      {message && <div className={`account-message ${message.kind}`}>{message.text}</div>}

      {status?.connected && (
        <p className="account-note">
          Die Spiel-Detailseiten zeigen damit den günstigsten aktuellen Shop-Preis und den
          historischen Tiefstpreis (Quelle: IsThereAnyDeal, Preise für Deutschland).
        </p>
      )}
    </section>
  )
}

export default AccountsView

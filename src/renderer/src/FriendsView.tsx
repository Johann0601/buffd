import { useCallback, useEffect, useState } from 'react'
import { User, Users, RefreshCw, Gamepad2, Lock, ChevronDown, ChevronRight } from 'lucide-react'
import type { FriendGame, SteamFriend, SteamFriendsResult } from '@shared/types'
import { formatLastPlayed, formatPlaytime } from './format'

// Freunde (Stufe A): zeigt die Steam-Freundesliste mit Online-Status und dem
// gerade gespielten Spiel. Pro Freund lässt sich (falls öffentlich) die
// Bibliothek aufklappen. Alles read-only über die Steam-Web-API — kein Server.

const STATE_LABEL: Record<SteamFriend['state'], string> = {
  ingame: 'spielt gerade',
  online: 'online',
  away: 'abwesend',
  busy: 'beschäftigt',
  offline: 'offline'
}

// Cover eines Spiels mit Fallback: manche Spiele haben kein library_600x900.jpg
// auf Steam (z. B. Upload Labs, Smartphone Tycoon) -> dann den Namen anzeigen,
// statt eines kaputten Bild-Symbols.
function GameCover({ game }: { game: FriendGame }): JSX.Element {
  const [failed, setFailed] = useState(false)
  if (failed || !game.coverUrl) {
    return (
      <span className="friend-game-cover">
        <span className="friend-game-noart">{game.name}</span>
      </span>
    )
  }
  return (
    <span className="friend-game-cover">
      <img src={game.coverUrl} alt="" loading="lazy" onError={() => setFailed(true)} />
    </span>
  )
}

function FriendRow({ friend }: { friend: SteamFriend }): JSX.Element {
  const [open, setOpen] = useState(false)
  const [games, setGames] = useState<FriendGame[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const toggle = async (): Promise<void> => {
    const next = !open
    setOpen(next)
    if (next && games === null && !loading) {
      setLoading(true)
      setNote(null)
      const res = await window.api.getFriendGames(friend.steamId)
      if (!res.ok) setNote(res.error ?? 'Bibliothek konnte nicht geladen werden.')
      else if (res.private) setNote('Dieser Freund teilt seine Spiele nicht öffentlich.')
      else if (res.games.length === 0) setNote('Keine Spiele gefunden.')
      setGames(res.games)
      setLoading(false)
    }
  }

  return (
    <div className={`friend-card ${open ? 'open' : ''}`}>
      <button className="friend-head" onClick={toggle} data-tip="Bibliothek anzeigen">
        <span className="friend-avatar-wrap">
          {friend.avatarUrl ? (
            <img className="friend-avatar" src={friend.avatarUrl} alt="" />
          ) : (
            <span className="friend-avatar friend-avatar-fallback">
              <User size={20} />
            </span>
          )}
          <span className={`friend-dot state-${friend.state}`} />
        </span>
        <span className="friend-main">
          <span className="friend-name">{friend.personaName}</span>
          <span className="friend-status">
            {friend.state === 'ingame' && friend.currentGame ? (
              <span className="icon-line">
                <Gamepad2 size={13} /> {friend.currentGame}
              </span>
            ) : (
              STATE_LABEL[friend.state]
            )}
            {friend.state === 'offline' && friend.lastLogoff
              ? ` · zuletzt ${formatLastPlayed(friend.lastLogoff)}`
              : ''}
          </span>
        </span>
        {!friend.private && (
          <span className="friend-caret">
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
        )}
        {friend.private && (
          <span className="friend-private" data-tip="Profil privat">
            <Lock size={14} />
          </span>
        )}
      </button>

      {open && (
        <div className="friend-body">
          {loading && <div className="friend-note">Lade Bibliothek …</div>}
          {!loading && note && <div className="friend-note">{note}</div>}
          {!loading && games && games.length > 0 && (
            <>
              <div className="friend-lib-head">{games.length} Spiele</div>
              <div className="friend-games">
                {games.slice(0, 60).map((g) => (
                  <a
                    key={g.appId}
                    className="friend-game"
                    href={`https://store.steampowered.com/app/${g.appId}/`}
                    target="_blank"
                    rel="noreferrer"
                    data-tip={g.name}
                  >
                    <GameCover game={g} />
                    <span className="friend-game-name">{g.name}</span>
                    <span className="friend-game-time">{formatPlaytime(g.playtimeSec)}</span>
                  </a>
                ))}
              </div>
              {games.length > 60 && (
                <div className="friend-note">… und {games.length - 60} weitere</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function FriendsView({ onOpenAccounts }: { onOpenAccounts: () => void }): JSX.Element {
  const [data, setData] = useState<SteamFriendsResult | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      setData(await window.api.getSteamFriends())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const friends = data?.friends ?? []
  const onlineCount = friends.filter((f) => f.state !== 'offline').length

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1 className="h2-icon">
            <Users size={22} /> Freunde
          </h1>
          <span className="subtitle">
            {loading
              ? 'lädt …'
              : data?.ok
                ? `${friends.length} Steam-Freunde · ${onlineCount} online`
                : 'Steam-Freunde'}
          </span>
        </div>
        <button className="btn" onClick={load} disabled={loading}>
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
        {/* Kein Steam-Key hinterlegt */}
        {!loading && data?.keyMissing && (
          <div className="banner info">
            Für die Freundesliste braucht buffd deinen (kostenlosen) Steam-Web-API-Key.
            <button className="link-btn" onClick={onOpenAccounts}>
              In den Konten-Einstellungen hinterlegen
            </button>
          </div>
        )}

        {/* Eigene Freundesliste ist privat */}
        {!loading && data && !data.ok && !data.keyMissing && data.listPrivate && (
          <div className="banner info">
            Deine Steam-Freundesliste ist auf „privat" gestellt. Stelle sie in Steam unter
            <em> Profil → Bearbeiten → Privatsphäre → „Freundesliste"</em> auf „Öffentlich", dann
            erscheinen deine Freunde hier.
          </div>
        )}

        {/* Sonstiger Fehler */}
        {!loading && data && !data.ok && !data.keyMissing && !data.listPrivate && (
          <div className="banner error">{data.error ?? 'Freunde konnten nicht geladen werden.'}</div>
        )}

        {/* Leere, aber öffentliche Liste */}
        {!loading && data?.ok && friends.length === 0 && (
          <div className="empty">Keine Steam-Freunde gefunden.</div>
        )}

        {/* Freundesliste */}
        {!loading && data?.ok && friends.length > 0 && (
          <div className="friend-list">
            {friends.map((f) => (
              <FriendRow key={f.steamId} friend={f} />
            ))}
          </div>
        )}

        <p className="hint">
          Zeigt deine <strong>Steam</strong>-Freunde mit Online-Status und aktuellem Spiel. Klick
          auf einen Freund, um (falls öffentlich) seine Bibliothek mit Spielzeiten zu sehen.
          Sichtbar ist nur, was jeder Freund über seine eigenen Steam-Privatsphäre-Einstellungen
          freigibt — buffd umgeht nichts.
        </p>
      </main>
    </div>
  )
}

export default FriendsView

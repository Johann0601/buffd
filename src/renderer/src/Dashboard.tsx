import { useState } from 'react'
import {
  Gamepad2,
  Clock,
  Users,
  Puzzle,
  Newspaper,
  Music,
  Check,
  Pencil,
  X,
  RotateCcw,
  GripVertical
} from 'lucide-react'
import type { GameCard, LibraryNewsItem, PlaytimePeriods, SteamFriend } from '@shared/types'
import type { LibrarySub, View } from './App'
import { formatPlaytime } from './format'
import SpotifyWidget from './SpotifyWidget'

// Anpassbares Dashboard auf der Startseite: Widgets lassen sich im Bearbeiten-
// Modus per Drag & Drop umsortieren sowie hinzufügen/entfernen. Auswahl +
// Reihenfolge werden lokal gespeichert (localStorage).

export type WidgetId = 'spiele' | 'playtime' | 'friends' | 'mods' | 'news' | 'spotify'

const ALL_WIDGETS: { id: WidgetId; Icon: typeof Gamepad2; title: string }[] = [
  { id: 'spiele', Icon: Gamepad2, title: 'Spiele' },
  { id: 'playtime', Icon: Clock, title: 'Spielzeit' },
  { id: 'friends', Icon: Users, title: 'Freunde online' },
  { id: 'mods', Icon: Puzzle, title: 'Mods' },
  { id: 'news', Icon: Newspaper, title: 'News' },
  { id: 'spotify', Icon: Music, title: 'Spotify' }
]
// Standard-Belegung beim ersten Start (Reihenfolge zählt). Mods & News sind
// nicht dabei, lassen sich aber jederzeit über „Anpassen" hinzufügen.
const DEFAULT_LAYOUT: WidgetId[] = ['spiele', 'playtime', 'friends']
const KNOWN = new Set(ALL_WIDGETS.map((w) => w.id))

function loadLayout(): WidgetId[] {
  try {
    const raw = JSON.parse(localStorage.getItem('dashboard-layout') ?? '') as WidgetId[]
    const valid = raw.filter((id) => KNOWN.has(id))
    if (valid.length > 0) return valid
  } catch {
    /* nichts gespeichert */
  }
  return DEFAULT_LAYOUT
}

interface DashboardProps {
  playable: GameCard[]
  totalSec: number
  wotRestore: number
  wotActive: number | null
  mcCount: number | null
  friends: SteamFriend[]
  friendsKeyMissing: boolean
  periods: PlaytimePeriods | null
  news: LibraryNewsItem[]
  onOpenLibrary: (sub: LibrarySub) => void
  onNavigate: (v: View) => void
}

function Dashboard(props: DashboardProps): JSX.Element {
  const [layout, setLayout] = useState<WidgetId[]>(loadLayout)
  const [editMode, setEditMode] = useState(false)
  const [dragId, setDragId] = useState<WidgetId | null>(null)
  const [period, setPeriod] = useState<keyof PlaytimePeriods>(
    () => (localStorage.getItem('dashboard-playtime-period') as keyof PlaytimePeriods) || 'd30'
  )

  const persist = (next: WidgetId[]): void => {
    setLayout(next)
    localStorage.setItem('dashboard-layout', JSON.stringify(next))
  }
  const addWidget = (id: WidgetId): void => persist([...layout, id])
  const removeWidget = (id: WidgetId): void => persist(layout.filter((x) => x !== id))
  const resetLayout = (): void => persist([...DEFAULT_LAYOUT])
  const handleDrop = (targetId: WidgetId): void => {
    if (!dragId || dragId === targetId) return setDragId(null)
    const arr = layout.filter((x) => x !== dragId)
    arr.splice(arr.indexOf(targetId), 0, dragId)
    persist(arr)
    setDragId(null)
  }
  const setPeriodPersist = (p: keyof PlaytimePeriods): void => {
    setPeriod(p)
    localStorage.setItem('dashboard-playtime-period', p)
  }

  const available = ALL_WIDGETS.filter((w) => !layout.includes(w.id))

  // Inhalt + Klickziel + „Aufmerksamkeit"-Markierung je Widget.
  const renderBody = (id: WidgetId): { node: JSX.Element; onClick?: () => void; attention?: boolean } => {
    switch (id) {
      case 'spiele':
        return {
          onClick: () => props.onOpenLibrary('spiele'),
          node: (
            <>
              <span className="stat-card-icon">
                <Gamepad2 size={26} />
              </span>
              <span className="stat-card-title">Spiele</span>
              <span className="stat-card-info">
                {props.playable.length} installiert · {formatPlaytime(props.totalSec)} gesamt
              </span>
            </>
          )
        }
      case 'mods': {
        const info =
          props.wotRestore > 0
            ? `${props.wotRestore} WoT-Mods wiederherstellen!`
            : [
                props.wotActive !== null ? `WoT: ${props.wotActive} aktiv` : null,
                props.mcCount !== null ? `Minecraft: ${props.mcCount} Profile` : null
              ]
                .filter(Boolean)
                .join(' · ') || '–'
        return {
          onClick: () => props.onOpenLibrary('mods'),
          attention: props.wotRestore > 0,
          node: (
            <>
              <span className="stat-card-icon">
                <Puzzle size={26} />
              </span>
              <span className="stat-card-title">Mods</span>
              <span className="stat-card-info">{info}</span>
            </>
          )
        }
      }
      case 'playtime': {
        const value = props.periods ? props.periods[period] : 0
        const labels: { k: keyof PlaytimePeriods; t: string }[] = [
          { k: 'd14', t: '14 T' },
          { k: 'd30', t: '30 T' },
          { k: 'd365', t: '365 T' }
        ]
        return {
          onClick: () => props.onNavigate('stats'),
          node: (
            <>
              <span className="stat-card-icon">
                <Clock size={26} />
              </span>
              <span className="stat-card-title">Spielzeit</span>
              <span className="widget-big">{props.periods ? formatPlaytime(value) : '—'}</span>
              <div className="widget-period">
                {labels.map((l) => (
                  <button
                    key={l.k}
                    className={`widget-period-btn ${period === l.k ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setPeriodPersist(l.k)
                    }}
                  >
                    {l.t}
                  </button>
                ))}
              </div>
            </>
          )
        }
      }
      case 'friends': {
        const online = props.friends.filter((f) => f.state !== 'offline')
        return {
          onClick: () => props.onNavigate('friends'),
          node: (
            <>
              <span className="stat-card-icon">
                <Users size={26} />
              </span>
              <span className="stat-card-title">Freunde online</span>
              {props.friendsKeyMissing ? (
                <span className="stat-card-info">Steam-Key nötig (in Konten)</span>
              ) : online.length === 0 ? (
                <span className="stat-card-info">Gerade niemand online</span>
              ) : (
                <div className="widget-friends">
                  <span className="stat-card-info">{online.length} online</span>
                  {online.slice(0, 3).map((f) => (
                    <div key={f.steamId} className="widget-friend">
                      <span className={`friend-dot state-${f.state}`} />
                      <span className="widget-friend-name">{f.personaName}</span>
                      {f.state === 'ingame' && f.currentGame && (
                        <span className="widget-friend-game">{f.currentGame}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )
        }
      }
      case 'news':
        return {
          node: (
            <>
              <span className="stat-card-title icon-line">
                <Newspaper size={16} /> News
              </span>
              {props.news.length === 0 ? (
                <span className="stat-card-info">Keine Neuigkeiten</span>
              ) : (
                <div className="widget-list">
                  {props.news.slice(0, 3).map((n) => (
                    <a
                      key={n.url}
                      className="widget-list-row"
                      href={n.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title={n.title}
                    >
                      <span className="widget-list-name">{n.title}</span>
                      <span className="widget-list-meta">{n.gameName}</span>
                    </a>
                  ))}
                </div>
              )}
            </>
          )
        }
      case 'spotify':
        return { node: <SpotifyWidget /> }
    }
  }

  return (
    <div className="dashboard">
      <div className="dashboard-toolbar">
        {editMode && (
          <button className="btn small" onClick={resetLayout} title="Auf Standard-Belegung zurücksetzen">
            <RotateCcw size={14} /> Zurücksetzen
          </button>
        )}
        <button
          className={`btn small ${editMode ? 'primary' : ''}`}
          onClick={() => setEditMode((e) => !e)}
        >
          {editMode ? (
            <>
              <Check size={14} /> Fertig
            </>
          ) : (
            <>
              <Pencil size={14} /> Anpassen
            </>
          )}
        </button>
      </div>

      <div className="dashboard-grid">
        {layout.map((id) => {
          const meta = ALL_WIDGETS.find((w) => w.id === id)
          if (!meta) return null
          const { node, onClick, attention } = renderBody(id)
          return (
            <div
              key={id}
              className={`widget stat-card ${id === 'news' ? 'wide' : ''} ${
                attention ? 'attention' : ''
              } ${editMode ? 'editing' : ''} ${dragId === id ? 'dragging' : ''}`}
              draggable={editMode}
              onDragStart={() => setDragId(id)}
              onDragEnd={() => setDragId(null)}
              onDragOver={(e) => editMode && e.preventDefault()}
              onDrop={() => handleDrop(id)}
              onClick={editMode ? undefined : onClick}
            >
              {editMode && (
                <>
                  <span className="widget-grip" title="Zum Verschieben ziehen">
                    <GripVertical size={16} />
                  </span>
                  <button
                    className="widget-remove"
                    title="Entfernen"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeWidget(id)
                    }}
                  >
                    <X size={15} />
                  </button>
                </>
              )}
              {node}
            </div>
          )
        })}
      </div>

      {editMode && available.length > 0 && (
        <div className="dashboard-add">
          <span className="dashboard-add-label">Hinzufügen:</span>
          {available.map((w) => (
            <button key={w.id} className="btn small" onClick={() => addWidget(w.id)}>
              <w.Icon size={14} /> {w.title} +
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default Dashboard

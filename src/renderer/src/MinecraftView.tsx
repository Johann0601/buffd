import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Box,
  RefreshCw,
  ExternalLink,
  FolderOpen,
  Server,
  Users,
  Wifi,
  WifiOff
} from 'lucide-react'
import type { GameCard, McLauncher, McProfile, McServerStatus } from '@shared/types'
import { formatLastPlayed, formatPlaytime } from './format'

const LAUNCHER_LABEL: Record<McLauncher, string> = {
  modrinth: 'Modrinth',
  curseforge: 'CurseForge',
  ftb: 'FTB App'
}

type Tab = 'launcher' | 'server'

function MinecraftView({ onBack }: { onBack?: () => void }): JSX.Element {
  const [tab, setTab] = useState<Tab>('launcher')

  const [profiles, setProfiles] = useState<McProfile[]>([])
  const [launcherIds, setLauncherIds] = useState<Partial<Record<McLauncher, number>>>({})
  const [loadingLaunchers, setLoadingLaunchers] = useState(true)

  const [servers, setServers] = useState<McServerStatus[]>([])
  const [loadingServers, setLoadingServers] = useState(false)
  const [serversLoaded, setServersLoaded] = useState(false)

  const loadLaunchers = async (): Promise<void> => {
    setLoadingLaunchers(true)
    try {
      setProfiles(await window.api.getMcProfiles())
      // IDs der Launcher-Einträge laden, um "Launcher öffnen" anbieten zu können.
      const games: GameCard[] = await window.api.listGames()
      const ids: Partial<Record<McLauncher, number>> = {}
      for (const g of games) {
        if (
          g.kind === 'launcher' &&
          (g.platform === 'modrinth' || g.platform === 'curseforge' || g.platform === 'ftb')
        ) {
          ids[g.platform] = g.id
        }
      }
      setLauncherIds(ids)
    } finally {
      setLoadingLaunchers(false)
    }
  }

  const loadServers = async (): Promise<void> => {
    setLoadingServers(true)
    try {
      setServers(await window.api.getMcServers())
      setServersLoaded(true)
    } finally {
      setLoadingServers(false)
    }
  }

  useEffect(() => {
    loadLaunchers()
  }, [])

  // Server erst abfragen, wenn der Server-Tab zum ersten Mal geöffnet wird.
  useEffect(() => {
    if (tab === 'server' && !serversLoaded && !loadingServers) loadServers()
  }, [tab, serversLoaded, loadingServers])

  const refresh = (): void => {
    if (tab === 'server') loadServers()
    else loadLaunchers()
  }
  const loading = tab === 'server' ? loadingServers : loadingLaunchers

  // Nach Launcher gruppieren (Reihenfolge: Modrinth, CurseForge, FTB).
  const groups = useMemo(() => {
    const order: McLauncher[] = ['modrinth', 'curseforge', 'ftb']
    return order
      .map((l) => [l, profiles.filter((p) => p.launcher === l)] as const)
      .filter(([, list]) => list.length > 0)
  }, [profiles])

  const subtitle =
    tab === 'server'
      ? `${servers.filter((s) => s.online).length} von ${servers.length} online`
      : `${profiles.length} Modpacks/Profile`

  return (
    <div className="app">
      <header className="topbar">
        {onBack && (
          <button className="btn" onClick={onBack}>
            <ArrowLeft size={16} /> Zurück
          </button>
        )}
        <div className="brand">
          <h1 className="h2-icon">
            <Box size={22} /> Minecraft
          </h1>
          <span className="subtitle">{subtitle}</span>
        </div>
        <button className="btn" onClick={refresh} disabled={loading}>
          {loading ? (
            'Lese …'
          ) : (
            <>
              <RefreshCw size={15} /> Aktualisieren
            </>
          )}
        </button>
      </header>

      <main className="content">
        <div className="mc-tabs">
          <button
            className={`chip ${tab === 'launcher' ? 'active' : ''}`}
            onClick={() => setTab('launcher')}
          >
            <Box size={15} /> Launcher
          </button>
          <button
            className={`chip ${tab === 'server' ? 'active' : ''}`}
            onClick={() => setTab('server')}
          >
            <Server size={15} /> Server
          </button>
        </div>

        {tab === 'launcher' ? (
          <>
            {!loadingLaunchers && profiles.length === 0 && (
              <div className="empty">Keine Profile gefunden (Modrinth, CurseForge, FTB App).</div>
            )}

            {groups.map(([launcher, list]) => (
              <section key={launcher} className="device-group">
                <div className="mc-group-header">
                  <h2 className="section-title">{LAUNCHER_LABEL[launcher]}</h2>
                  {launcherIds[launcher] !== undefined && (
                    <button
                      className="btn tiny"
                      onClick={() => window.api.launchGame(launcherIds[launcher]!)}
                    >
                      Launcher öffnen <ExternalLink size={13} />
                    </button>
                  )}
                </div>
                <div className="device-list">
                  {list.map((p) => (
                    <ProfileRow key={p.instancePath} profile={p} />
                  ))}
                </div>
              </section>
            ))}
          </>
        ) : (
          <>
            {loadingServers && servers.length === 0 && (
              <div className="empty">Frage Server ab …</div>
            )}
            {!loadingServers && servers.length === 0 && (
              <div className="empty">Keine Server konfiguriert.</div>
            )}
            <div className="device-list">
              {servers.map((s) => (
                <ServerRow key={s.id} server={s} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function ProfileRow({ profile }: { profile: McProfile }): JSX.Element {
  const meta = [
    profile.mcVersion && `MC ${profile.mcVersion}`,
    profile.modLoader,
    profile.modCount !== null && `${profile.modCount} Mods`
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="device-row">
      <div className="device-row-top">
        <div className="mc-profile">
          {profile.iconUrl ? (
            <img className="mc-icon" src={profile.iconUrl} alt="" />
          ) : (
            <span className="mc-icon fallback">
              <Box size={20} />
            </span>
          )}
          <div className="device-main">
            <div className="device-name">{profile.name}</div>
            <div className="device-vendor">{meta}</div>
          </div>
        </div>
        <div className="mc-right">
          <div className="mc-meta">
            <span>Zuletzt: {formatLastPlayed(profile.lastPlayed)}</span>
            {profile.playtimeSec !== null && (
              <span>Spielzeit: {formatPlaytime(profile.playtimeSec)}</span>
            )}
          </div>
          <button
            className="btn tiny"
            data-tip="Instanz-Ordner im Explorer öffnen"
            onClick={() => window.api.openMcFolder(profile.instancePath)}
          >
            <FolderOpen size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}

function ServerRow({ server: s }: { server: McServerStatus }): JSX.Element {
  const address = s.port === 25565 ? s.host : `${s.host}:${s.port}`
  return (
    <div className="device-row">
      <div className="device-row-top">
        <div className="mc-profile">
          {s.faviconDataUrl ? (
            <img className="mc-icon" src={s.faviconDataUrl} alt="" />
          ) : (
            <span className="mc-icon fallback">
              <Server size={20} />
            </span>
          )}
          <div className="device-main">
            <div className="device-name">{s.label}</div>
            <div className="device-vendor">{address}</div>
            {s.online && s.motd && <div className="mc-server-motd">{s.motd}</div>}
          </div>
        </div>
        <div className="mc-right">
          {s.online ? (
            <div className="mc-server-stats">
              <span className="mc-server-players">
                <Users size={15} /> {s.playersOnline?.toLocaleString('de-DE') ?? '–'}
                {s.playersMax !== null && (
                  <span className="mc-server-max"> / {s.playersMax.toLocaleString('de-DE')}</span>
                )}
              </span>
              <span className="mc-server-sub">
                {s.version && <span>{s.version}</span>}
                {s.pingMs !== null && (
                  <span className="mc-ping">
                    <Wifi size={13} /> {s.pingMs} ms
                  </span>
                )}
              </span>
            </div>
          ) : (
            <span className="mc-server-offline">
              <WifiOff size={15} /> Offline
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default MinecraftView

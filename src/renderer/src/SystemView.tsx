import { useEffect, useMemo, useState } from 'react'
import type { DeviceCategory, DeviceInfo, GameStorageInfo, NvidiaUpdate } from '@shared/types'
import { formatGameSize, formatLastPlayed } from './format'
import { platformLabel } from './platforms'
import { uninstallActionFor } from './uninstallAction'

const CATEGORY_ICON: Record<DeviceCategory, string> = {
  Grafikkarte: '🎞️',
  Prozessor: '🧠',
  Monitor: '🖥️',
  Maus: '🖱️',
  Tastatur: '⌨️',
  Audio: '🔊',
  Netzwerk: '🌐',
  Bluetooth: '🔵',
  Speicher: '💾'
}

const COLLAPSED_KEY = 'system-collapsed-categories'

function loadCollapsed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

/** Bytes -> "931 GB" bzw. "1,86 TB". */
function formatBytes(bytes: number): string {
  const gib = bytes / 1024 ** 3
  if (gib >= 1024) return `${(gib / 1024).toFixed(2).replace('.', ',')} TB`
  return `${Math.round(gib)} GB`
}

function SystemView({ onBack }: { onBack?: () => void }): JSX.Element {
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsed)
  const [updates, setUpdates] = useState<Record<string, NvidiaUpdate | null>>({})
  // Die zwei Hauptbereiche: Speicherplatz startet ZU, Hardware startet OFFEN.
  const [storageOpen, setStorageOpen] = useState(
    () => localStorage.getItem('system-storage-open') === '1'
  )
  const [hardwareOpen, setHardwareOpen] = useState(
    () => localStorage.getItem('system-hardware-open') !== '0'
  )

  useEffect(() => {
    localStorage.setItem('system-storage-open', storageOpen ? '1' : '0')
  }, [storageOpen])
  useEffect(() => {
    localStorage.setItem('system-hardware-open', hardwareOpen ? '1' : '0')
  }, [hardwareOpen])

  const load = async (): Promise<void> => {
    setLoading(true)
    try {
      const devs = await window.api.getDevices()
      setDevices(devs)

      const nvidiaGpus = devs.filter((d) => d.isNvidiaGpu)
      setUpdates(Object.fromEntries(nvidiaGpus.map((d) => [d.name, null])))
      for (const d of nvidiaGpus) {
        window.api
          .checkNvidiaUpdate(d.name, d.driverVersion)
          .then((u) => setUpdates((prev) => ({ ...prev, [d.name]: u })))
          .catch(() =>
            setUpdates((prev) => ({
              ...prev,
              [d.name]: {
                ok: false,
                installedVersion: null,
                latestVersion: null,
                updateAvailable: false,
                downloadUrl: null,
                releaseDate: null,
                error: 'Abfrage fehlgeschlagen.'
              }
            }))
          )
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]))
  }, [collapsed])

  const toggle = (cat: string): void => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  // Geräte nach Kategorie gruppieren (in Anzeige-Reihenfolge).
  const groups = useMemo(() => {
    const map = new Map<DeviceCategory, DeviceInfo[]>()
    for (const d of devices) {
      const list = map.get(d.category) ?? []
      list.push(d)
      map.set(d.category, list)
    }
    return [...map.entries()]
  }, [devices])

  return (
    <div className="app">
      <header className="topbar">
        {onBack && (
          <button className="btn" onClick={onBack}>
            ← Zurück
          </button>
        )}
        <div className="brand">
          <h1>🖥️ System / Treiber</h1>
          <span className="subtitle">{devices.length} Geräte</span>
        </div>
        <button className="btn" onClick={load} disabled={loading}>
          {loading ? 'Lese …' : '↻ Aktualisieren'}
        </button>
      </header>

      <main className="content">
        {loading && devices.length === 0 && <div className="empty">Lese Geräte …</div>}

        {/* Zwei Hauptbereiche: Speicherplatz (zugeklappt) und Hardware. */}
        <section className="device-group main-group">
          <button className="group-header main" onClick={() => setStorageOpen((o) => !o)}>
            <span className={`caret ${storageOpen ? '' : 'closed'}`}>▾</span>
            <span className="group-title">🎮 Speicherplatz der Spiele</span>
          </button>
          {storageOpen && <GameStorageSection />}
        </section>

        <section className="device-group main-group">
          <button className="group-header main" onClick={() => setHardwareOpen((o) => !o)}>
            <span className={`caret ${hardwareOpen ? '' : 'closed'}`}>▾</span>
            <span className="group-title">🖥️ Hardware</span>
            <span className="group-count">{devices.length}</span>
          </button>
          {hardwareOpen && (
            <div className="subgroup-list">
              <div className="banner info">
                Zeigt die <strong>installierte</strong> Treiberversion pro Gerät. Eine
                Update-Prüfung ist <strong>nur für Nvidia-GPUs</strong> zuverlässig möglich – für
                AMD, Intel, Logitech &amp; Co. lässt sich die neueste Version nicht verlässlich
                automatisch ermitteln.
              </div>
              {groups.map(([category, list]) => {
                const isCollapsed = collapsed.has(category)
                return (
                  <section key={category} className="device-group">
                    <button className="group-header" onClick={() => toggle(category)}>
                      <span className={`caret ${isCollapsed ? 'closed' : ''}`}>▾</span>
                      <span className="group-title">
                        {CATEGORY_ICON[category]} {category}
                      </span>
                      <span className="group-count">{list.length}</span>
                    </button>
                    {!isCollapsed && (
                      <div className="device-list">
                        {list.map((d, i) => (
                          <DeviceRow
                            key={`${category}-${i}`}
                            device={d}
                            update={d.isNvidiaGpu ? updates[d.name] : undefined}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

// Ab dieser Größe + Inaktivität wird ein Spiel als Aufräum-Kandidat markiert.
const CLEANUP_MIN_BYTES = 10 * 1024 ** 3 // 10 GB
const CLEANUP_IDLE_SEC = 90 * 24 * 3600 // 90 Tage

/** Speicherplatz der Spiele: Größen-Ranking mit Balken + Aufräum-Tipps. */
function GameStorageSection(): JSX.Element {
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

  if (games.length === 0) return <></>

  return (
    <div className="subgroup-list">
      <div className="storage-controls">
        {known.length > 0 && (
          <span className="storage-total">
            {known.length} Spiele · zusammen {formatGameSize(totalBytes)}
          </span>
        )}
        <button className="btn small" onClick={analyze} disabled={analyzing}>
          {analyzing ? 'Berechne …' : known.length > 0 ? '↻ Neu berechnen' : 'Größen berechnen'}
        </button>
      </div>

      {known.length === 0 && !analyzing && (
        <p className="hint">
          Klicke auf „Größen berechnen" — die App durchläuft dann einmalig alle Spielordner
          (das kann bei großen Spielen ein paar Minuten dauern). Danach ist das Ergebnis
          gespeichert.
        </p>
      )}
      {analyzing && (
        <p className="hint">⏳ Berechne Ordnergrößen … die Liste füllt sich Spiel für Spiel.</p>
      )}

      <div className="storage-game-list">
        {games.map((g) => {
          const idle = g.lastPlayed === null || now - g.lastPlayed > CLEANUP_IDLE_SEC
          const isCleanupTip = idle && (g.sizeBytes ?? 0) >= CLEANUP_MIN_BYTES
          const pct = maxBytes > 0 && g.sizeBytes ? Math.max(2, (g.sizeBytes / maxBytes) * 100) : 0
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
                    title={
                      g.platform === 'steam'
                        ? 'Deinstallieren (öffnet Steams Bestätigungs-Dialog)'
                        : 'Deinstallieren (öffnet den Launcher)'
                    }
                    onClick={() => uninstall(g)}
                  >
                    🗑
                  </button>
                )}
              </div>
              {g.sizeBytes !== null && (
                <div className="storage-track slim">
                  <div className="storage-fill" style={{ width: `${pct}%` }} />
                </div>
              )}
              {isCleanupTip && g.sizeBytes !== null && (
                <div className="storage-cleanup-tip">
                  💡 Seit über 3 Monaten nicht gespielt — Deinstallieren würde{' '}
                  <b>{formatGameSize(g.sizeBytes)}</b> freigeben.
                </div>
              )}
              {uninstallNotice?.gameId === g.gameId && (
                <div className="storage-cleanup-tip">ℹ️ {uninstallNotice.text}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DeviceRow({
  device,
  update
}: {
  device: DeviceInfo
  update?: NvidiaUpdate | null
}): JSX.Element {
  return (
    <div className="device-row">
      <div className="device-row-top">
        <div className="device-main">
          <div className="device-name">{device.name}</div>
          <div className="device-vendor">{device.vendor}</div>
        </div>
        {!device.storage && device.driverVersion && (
          <div className="device-driver">
            <div className="driver-version">{device.driverVersion}</div>
            {device.driverDate && <div className="driver-date">{device.driverDate}</div>}
          </div>
        )}
      </div>

      {device.storage && <StorageBar storage={device.storage} />}
      {device.isNvidiaGpu && <NvidiaUpdateRow update={update} />}
    </div>
  )
}

function StorageBar({ storage }: { storage: { totalBytes: number; freeBytes: number } }): JSX.Element {
  const { totalBytes, freeBytes } = storage
  const used = Math.max(0, totalBytes - freeBytes)
  const pct = totalBytes ? Math.round((used / totalBytes) * 100) : 0
  return (
    <div className="storage">
      <div className="storage-track">
        <div className={`storage-fill ${pct >= 90 ? 'full' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="storage-text">
        {formatBytes(freeBytes)} frei von {formatBytes(totalBytes)} · {pct}% belegt
      </div>
    </div>
  )
}

function NvidiaUpdateRow({ update }: { update?: NvidiaUpdate | null }): JSX.Element | null {
  if (update === undefined) return null
  if (update === null) {
    return <div className="nvidia-update loading">⏳ Prüfe auf Treiber-Update …</div>
  }
  if (!update.ok) {
    return (
      <div className="nvidia-update muted">
        Update-Status nicht ermittelbar{update.error ? ` (${update.error})` : ''}
      </div>
    )
  }
  if (update.updateAvailable) {
    const openApp = async (): Promise<void> => {
      const ok = await window.api.openNvidiaApp()
      if (!ok) window.open('https://www.nvidia.com/Download/index.aspx', '_blank')
    }
    return (
      <div className="nvidia-update available">
        <span>
          ⬆ Update verfügbar: <strong>{update.latestVersion}</strong>
          {update.releaseDate ? ` (${update.releaseDate})` : ''} · installiert:{' '}
          {update.installedVersion}
        </span>
        <button className="btn small" onClick={openApp}>
          In NVIDIA App öffnen ↗
        </button>
      </div>
    )
  }
  return (
    <div className="nvidia-update ok">✓ Treiber aktuell (Version {update.installedVersion})</div>
  )
}

export default SystemView

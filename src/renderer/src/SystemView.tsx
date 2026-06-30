import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import {
  ArrowLeft,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  CircleArrowUp,
  CircleCheck,
  ExternalLink,
  Hourglass,
  MonitorCog,
  Cpu,
  Monitor,
  Mouse,
  Keyboard,
  Volume2,
  Globe,
  Bluetooth,
  HardDrive,
  Pencil,
  Check,
  X,
  RotateCcw
} from 'lucide-react'
import type { DeviceCategory, DeviceInfo, NvidiaUpdate } from '@shared/types'

const CATEGORY_ICON: Record<DeviceCategory, typeof Cpu> = {
  Grafikkarte: MonitorCog,
  Prozessor: Cpu,
  Monitor: Monitor,
  Maus: Mouse,
  Tastatur: Keyboard,
  Audio: Volume2,
  Netzwerk: Globe,
  Bluetooth: Bluetooth,
  Speicher: HardDrive
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

function SystemView({
  onBack,
  embedded,
  onOpenStorage
}: {
  onBack?: () => void
  embedded?: boolean
  onOpenStorage?: () => void
}): JSX.Element {
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsed)
  const [updates, setUpdates] = useState<Record<string, NvidiaUpdate | null>>({})

  const load = async (): Promise<void> => {
    setLoading(true)
    try {
      const devs = await window.api.getDevices()
      setDevices(devs)

      const nvidiaGpus = devs.filter((d) => d.isNvidiaGpu)
      setUpdates(Object.fromEntries(nvidiaGpus.map((d) => [d.id, null])))
      for (const d of nvidiaGpus) {
        // defaultName (nicht den evtl. umbenannten Namen) für die GPU-Erkennung nutzen.
        window.api
          .checkNvidiaUpdate(d.defaultName, d.driverVersion)
          .then((u) => setUpdates((prev) => ({ ...prev, [d.id]: u })))
          .catch(() =>
            setUpdates((prev) => ({
              ...prev,
              [d.id]: {
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

  // Eigenen Namen setzen (name = null -> zurück auf Original) und lokal übernehmen.
  const handleRename = async (id: string, name: string | null): Promise<void> => {
    await window.api.renameDevice(id, name)
    setDevices((prev) =>
      prev.map((d) => (d.id === id ? { ...d, name: name?.trim() || d.defaultName } : d))
    )
  }

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
    <div className={embedded ? 'set-sub' : 'app'}>
      <header className={embedded ? 'topbar topbar-embedded' : 'topbar'}>
        {onBack && (
          <button className="btn" onClick={onBack}>
            <ArrowLeft size={16} /> Zurück
          </button>
        )}
        <div className="brand">
          <h1 className="h2-icon">
            <MonitorCog size={22} /> System / Treiber
          </h1>
          <span className="subtitle">{devices.length} Geräte</span>
        </div>
        <button className="btn" onClick={load} disabled={loading}>
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
        {loading && devices.length === 0 && <div className="empty">Lese Geräte …</div>}

        <div className="banner info">
          Zeigt die <strong>installierte</strong> Treiberversion pro Gerät. Eine Update-Prüfung ist{' '}
          <strong>nur für Nvidia-GPUs</strong> zuverlässig möglich – für AMD, Intel, Logitech &amp;
          Co. lässt sich die neueste Version nicht verlässlich automatisch ermitteln.
        </div>
        {groups.map(([category, list]) => {
          const isCollapsed = collapsed.has(category)
          return (
            <section key={category} className="device-group">
              <button className="group-header" onClick={() => toggle(category)}>
                <span className={`caret ${isCollapsed ? 'closed' : ''}`}>
                  <ChevronDown size={16} />
                </span>
                <span className="group-title icon-line">
                  {(() => {
                    const Icon = CATEGORY_ICON[category]
                    return <Icon size={17} />
                  })()}
                  {category}
                </span>
                <span className="group-count">{list.length}</span>
              </button>
              {!isCollapsed && (
                <div className="device-list">
                  {list.map((d, i) => (
                    <DeviceRow
                      key={`${category}-${i}`}
                      device={d}
                      update={d.isNvidiaGpu ? updates[d.id] : undefined}
                      onRename={handleRename}
                      onOpenStorage={onOpenStorage}
                    />
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </main>
    </div>
  )
}

function DeviceRow({
  device,
  update,
  onRename,
  onOpenStorage
}: {
  device: DeviceInfo
  update?: NvidiaUpdate | null
  onRename: (id: string, name: string | null) => void | Promise<void>
  onOpenStorage?: () => void
}): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(device.name)
  const isCustom = device.name !== device.defaultName
  // Speicher-Zeilen führen per Klick ins Speicher-Menü (außer beim Umbenennen).
  const clickable = !!device.storage && !!onOpenStorage && !editing

  const startEdit = (e: MouseEvent): void => {
    e.stopPropagation() // nicht ins Speicher-Menü navigieren
    setValue(device.name)
    setEditing(true)
  }
  const save = (): void => {
    const v = value.trim()
    onRename(device.id, v && v !== device.defaultName ? v : null)
    setEditing(false)
  }
  const reset = (): void => {
    onRename(device.id, null)
    setEditing(false)
  }

  return (
    <div
      className={`device-row${clickable ? ' clickable' : ''}`}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onOpenStorage : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onOpenStorage?.()
              }
            }
          : undefined
      }
    >
      <div className="device-row-top">
        <div className="device-main">
          {editing ? (
            <div className="device-rename" onClick={(e) => e.stopPropagation()}>
              <input
                className="device-rename-input"
                value={value}
                autoFocus
                placeholder={device.defaultName}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') save()
                  else if (e.key === 'Escape') setEditing(false)
                }}
              />
              <button className="icon-btn" title="Speichern" onClick={save}>
                <Check size={15} />
              </button>
              {isCustom && (
                <button className="icon-btn" title="Auf Originalnamen zurücksetzen" onClick={reset}>
                  <RotateCcw size={15} />
                </button>
              )}
              <button className="icon-btn" title="Abbrechen" onClick={() => setEditing(false)}>
                <X size={15} />
              </button>
            </div>
          ) : (
            <div className="device-name">
              {device.name}
              <button className="icon-btn rename" title="Gerät umbenennen" onClick={startEdit}>
                <Pencil size={13} />
              </button>
              {isCustom && (
                <span className="device-renamed" title={`Original: ${device.defaultName}`}>
                  umbenannt
                </span>
              )}
            </div>
          )}
          <div className="device-vendor">{device.vendor}</div>
        </div>
        {!device.storage && device.driverVersion && (
          <div className="device-driver">
            <div className="driver-version">{device.driverVersion}</div>
            {device.driverDate && <div className="driver-date">{device.driverDate}</div>}
          </div>
        )}
        {clickable && (
          <span className="device-go" title="Im Speicher-Menü öffnen">
            <ChevronRight size={18} />
          </span>
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
    return (
      <div className="nvidia-update loading icon-line">
        <Hourglass size={14} /> Prüfe auf Treiber-Update …
      </div>
    )
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
        <span className="icon-line">
          <CircleArrowUp size={15} /> Update verfügbar: <strong>{update.latestVersion}</strong>
          {update.releaseDate ? ` (${update.releaseDate})` : ''} · installiert:{' '}
          {update.installedVersion}
        </span>
        <button className="btn small" onClick={openApp}>
          In NVIDIA App öffnen <ExternalLink size={14} />
        </button>
      </div>
    )
  }
  return (
    <div className="nvidia-update ok icon-line">
      <CircleCheck size={15} /> Treiber aktuell (Version {update.installedVersion})
    </div>
  )
}

export default SystemView

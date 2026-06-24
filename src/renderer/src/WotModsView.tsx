import { useEffect, useState } from 'react'
import { ArrowLeft, Wrench, FolderOpen, RefreshCw, TriangleAlert } from 'lucide-react'
import type { WotStatus } from '@shared/types'

function formatSize(bytes: number): string {
  if (bytes <= 0) return ''
  const mb = bytes / 1024 ** 2
  return mb >= 1 ? `${mb.toFixed(1).replace('.', ',')} MB` : `${Math.round(bytes / 1024)} KB`
}

function WotModsView({ onBack }: { onBack?: () => void }): JSX.Element {
  const [status, setStatus] = useState<WotStatus | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<WotStatus>): Promise<void> => {
    setBusy(true)
    try {
      setStatus(await action())
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    run(() => window.api.getWotStatus())
  }, [])

  const mods = status?.mods ?? []
  const active = mods.filter((m) => m.enabled && m.installed).length

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
            <Wrench size={22} /> World of Tanks
          </h1>
          {status?.ok && (
            <span className="subtitle">
              Version {status.currentVersion} · {active} aktiv
            </span>
          )}
        </div>
        <div className="topbar-actions">
          <button className="btn" onClick={() => window.api.openWotModsFolder()} disabled={!status?.ok}>
            <FolderOpen size={15} /> Mod-Ordner
          </button>
          <button className="btn" onClick={() => run(() => window.api.addWotMods())} disabled={busy || !status?.ok}>
            + Mod hinzufügen
          </button>
          <button className="btn" onClick={() => run(() => window.api.getWotStatus())} disabled={busy}>
            {busy ? (
              '…'
            ) : (
              <>
                <RefreshCw size={15} /> Aktualisieren
              </>
            )}
          </button>
        </div>
      </header>

      <main className="content">
        {status && !status.ok && (
          <div className="banner error icon-line">
            <TriangleAlert size={16} /> {status.error}
          </div>
        )}

        {status?.ok && (
          <div className="banner info">
            Mods werden als Kopie in der App-Bibliothek gesichert. Aus/Einschalten verschiebt
            nur die Datei im Spielordner. Nach einem WoT-Update legt das Spiel einen neuen
            Versionsordner an — buffd verschiebt dann nichts von selbst; betroffene Mods werden
            als „fehlt im Spielordner" markiert und kommen durch erneutes Aktivieren zurück.
            Verwaltet werden <code>.wotmod</code>-Dateien (der Standard moderner WoT-Mods).
          </div>
        )}

        {status?.ok && mods.length === 0 && (
          <div className="empty">Keine Mods gefunden. Füge welche über „+ Mod hinzufügen" hinzu.</div>
        )}

        <div className="device-list">
          {mods.map((m) => (
            <div key={m.id} className="device-row">
              <div className="device-row-top">
                <div className="device-main">
                  <div className="device-name">
                    {m.displayName}
                    {m.enabled && !m.installed && <span className="tag update">fehlt im Spielordner</span>}
                  </div>
                  <div className="device-vendor">
                    {m.fileName} {formatSize(m.sizeBytes) && `· ${formatSize(m.sizeBytes)}`}
                  </div>
                </div>
                <label className="switch" title={m.enabled ? 'Deaktivieren' : 'Aktivieren'}>
                  <input
                    type="checkbox"
                    checked={m.enabled}
                    disabled={busy}
                    onChange={(e) => run(() => window.api.toggleWotMod(m.id, e.target.checked))}
                  />
                  <span className="slider" />
                </label>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

export default WotModsView

import { useEffect, useState } from 'react'
import {
  SlidersHorizontal,
  User,
  HardDrive,
  MonitorCog,
  Info,
  Trash2,
  RefreshCw,
  Wrench,
  FolderOpen
} from 'lucide-react'
import AccountsView from './AccountsView'
import ChangelogView from './ChangelogView'
import StorageView from './StorageView'
import SystemView from './SystemView'
import type { Theme, View } from './App'

/** „Zuletzt geprüft"-Zeitpunkt menschlich darstellen (relativ, sonst Datum+Uhrzeit). */
function formatChecked(ms: number): string {
  const diffSec = Math.max(0, Math.round((Date.now() - ms) / 1000))
  if (diffSec < 60) return 'gerade eben'
  if (diffSec < 3600) return `vor ${Math.floor(diffSec / 60)} Min.`
  if (diffSec < 86400) return `vor ${Math.floor(diffSec / 3600)} Std.`
  return new Date(ms).toLocaleString('de-DE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

type Section = 'allgemein' | 'konten' | 'speicher' | 'system' | 'app' | 'ueber'

const NAV: { key: Section; view: View; label: string; Icon: typeof User }[] = [
  { key: 'allgemein', view: 'settings', label: 'Allgemein', Icon: SlidersHorizontal },
  { key: 'konten', view: 'settings-accounts', label: 'Konten', Icon: User },
  { key: 'speicher', view: 'settings-storage', label: 'Speicher', Icon: HardDrive },
  { key: 'system', view: 'settings-system', label: 'System', Icon: MonitorCog },
  { key: 'app', view: 'settings-app', label: 'App', Icon: Wrench },
  { key: 'ueber', view: 'settings-changelog', label: 'Über', Icon: Info }
]

// Einstellungen (Redesign nach Entwurf „buffd-settings"): persistente Unter-
// navigation links + Inhalts-Panel rechts. Die bestehenden Unterseiten (Konten,
// Speicher, System, Changelog) werden als Panels eingebettet (embedded-Flag).
function SettingsView({
  view,
  onNavigate,
  theme,
  onThemeChange
}: {
  view: View
  onNavigate: (v: View) => void
  theme: Theme
  onThemeChange: (t: Theme) => void
}): JSX.Element {
  const section: Section =
    view === 'settings-accounts'
      ? 'konten'
      : view === 'settings-storage'
        ? 'speicher'
        : view === 'settings-system'
          ? 'system'
          : view === 'settings-app'
            ? 'app'
            : view === 'settings-changelog'
              ? 'ueber'
              : 'allgemein'

  const [appVersion, setAppVersion] = useState('')
  useEffect(() => {
    window.api.getAppVersion().then(setAppVersion).catch(() => {})
  }, [])

  // Speicherort: wo liegt das Programm und wo die eigenen Daten (Spielzeit/Einstellungen)?
  const [installInfo, setInstallInfo] = useState<{ installDir: string; dataDir: string } | null>(
    null
  )
  useEffect(() => {
    window.api.getInstallInfo().then(setInstallInfo).catch(() => {})
  }, [])

  // Manuell nach App-Updates suchen: Lauf-Zustand + Ergebnis-Hinweis + letzter Check.
  const [checkingUpdates, setCheckingUpdates] = useState(false)
  const [updateNote, setUpdateNote] = useState<string | null>(null)
  const [lastChecked, setLastChecked] = useState<number | null>(() => {
    const v = Number(localStorage.getItem('update-last-checked'))
    return v > 0 ? v : null
  })
  const rememberChecked = (ts: number): void => {
    setLastChecked(ts)
    localStorage.setItem('update-last-checked', String(ts))
  }
  useEffect(() => {
    window.api
      .getLastUpdateCheck()
      .then((ts) => {
        if (ts && ts > (Number(localStorage.getItem('update-last-checked')) || 0)) rememberChecked(ts)
      })
      .catch(() => {})
  }, [])
  const checkUpdates = async (): Promise<void> => {
    setCheckingUpdates(true)
    setUpdateNote(null)
    try {
      const res = await window.api.checkForAppUpdates()
      if (res.ok && res.checkedAt) rememberChecked(res.checkedAt)
      if (!res.ok) {
        setUpdateNote(
          res.reason === 'dev' || res.reason === 'noconfig'
            ? 'Nur in der installierten Version verfügbar — dies ist ein Testbuild.'
            : 'Prüfung fehlgeschlagen — bist du online?'
        )
      } else if (res.updateAvailable) {
        setUpdateNote(
          `Update gefunden: buffd ${res.version} wird im Hintergrund geladen. Du wirst benachrichtigt, sobald es bereit ist.`
        )
      } else {
        setUpdateNote('Du bist auf dem neuesten Stand.')
      }
    } finally {
      setCheckingUpdates(false)
    }
  }

  // Deinstallieren: Rückfrage-Zustand + Hinweis (z. B. im Experimentier-Build).
  const [confirmUninstall, setConfirmUninstall] = useState(false)
  const [deleteData, setDeleteData] = useState(false)
  const [uninstallNote, setUninstallNote] = useState<string | null>(null)
  const doUninstall = async (): Promise<void> => {
    const res = await window.api.uninstallApp({ deleteData })
    if (!res.ok) {
      setConfirmUninstall(false)
      setUninstallNote(
        res.reason === 'experimental'
          ? 'Deinstallieren geht nur in der installierten Version — dies ist ein experimenteller Build.'
          : 'Deinstallieren nicht möglich.'
      )
    }
  }

  return (
    <div className="set-view">
      <header className="set-topbar">
        <h1>Einstellungen</h1>
        {appVersion && <span className="set-ver">buffd v{appVersion}</span>}
      </header>

      <div className="set-body">
        <nav className="set-nav">
          <span className="set-nav-cap">Einstellungen</span>
          {NAV.map(({ key, view: target, label, Icon }) => (
            <button
              key={key}
              className={`set-nav-item ${section === key ? 'active' : ''}`}
              onClick={() => onNavigate(target)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="set-panel">
          {section === 'allgemein' && (
            <>
              <div className="set-panel-head">
                <h2>Allgemein</h2>
                <p className="set-panel-desc">
                  Grundlegende App-Einstellungen. Weitere Optionen (Autostart, Tray, einzelne
                  Launcher) folgen.
                </p>
              </div>
              <span className="set-cap">Darstellung</span>
              <div className="set-card">
                <div className="set-row">
                  <div className="set-row-main">
                    <div className="set-row-title">Dunkles Design</div>
                    <div className="set-row-desc">
                      Dunkles Erscheinungsbild (Standard). Ausschalten für den Hell-Modus.
                    </div>
                  </div>
                  <label className="switch" title="Darkmode an/aus">
                    <input
                      type="checkbox"
                      checked={theme === 'dark'}
                      onChange={(e) => onThemeChange(e.target.checked ? 'dark' : 'light')}
                    />
                    <span className="slider" />
                  </label>
                </div>
              </div>
            </>
          )}

          {section === 'konten' && <AccountsView embedded />}
          {section === 'speicher' && <StorageView embedded />}
          {section === 'system' && <SystemView embedded />}

          {section === 'app' && (
            <>
              <div className="set-panel-head">
                <h2>App</h2>
                <p className="set-panel-desc">
                  App-Updates und Verwaltung von buffd.
                </p>
              </div>

              <span className="set-cap">Updates</span>
              <div className="set-card">
                <div className="set-row">
                  <div className="set-row-main">
                    <div className="set-row-title">Nach Updates suchen</div>
                    <div className="set-row-desc">
                      Sofort prüfen, ob eine neuere buffd-Version verfügbar ist. Normalerweise
                      passiert das automatisch beim Start.
                    </div>
                    {lastChecked && (
                      <div className="set-row-desc">Zuletzt geprüft: {formatChecked(lastChecked)}</div>
                    )}
                    {updateNote && <div className="set-row-note">{updateNote}</div>}
                  </div>
                  <button className="btn" onClick={checkUpdates} disabled={checkingUpdates}>
                    {checkingUpdates ? (
                      'Prüfe …'
                    ) : (
                      <>
                        <RefreshCw size={16} /> Suchen
                      </>
                    )}
                  </button>
                </div>
              </div>

              <span className="set-cap">Speicherort</span>
              <div className="set-card">
                <div className="set-row">
                  <div className="set-row-main">
                    <div className="set-row-title">Programmordner</div>
                    <div className="set-row-desc">Hier ist buffd installiert.</div>
                    {installInfo && <div className="set-row-path">{installInfo.installDir}</div>}
                  </div>
                  <button
                    className="btn"
                    onClick={() => window.api.openInstallDir()}
                    disabled={!installInfo}
                  >
                    <FolderOpen size={16} /> Öffnen
                  </button>
                </div>
                <div className="set-row">
                  <div className="set-row-main">
                    <div className="set-row-title">Datenordner</div>
                    <div className="set-row-desc">
                      Deine Spielzeit, Statistik und Einstellungen liegen hier. Bleibt bei einer
                      Deinstallation erhalten (außer du wählst „Daten auch löschen").
                    </div>
                    {installInfo && <div className="set-row-path">{installInfo.dataDir}</div>}
                  </div>
                  <button
                    className="btn"
                    onClick={() => window.api.openDataDir()}
                    disabled={!installInfo}
                  >
                    <FolderOpen size={16} /> Öffnen
                  </button>
                </div>
              </div>

              <span className="set-cap">Verwaltung</span>
              <div className="set-card">
                <div className="set-row">
                  <div className="set-row-main">
                    <div className="set-row-title">buffd deinstallieren</div>
                    <div className="set-row-desc">
                      Entfernt das Programm von diesem PC. Deine Spiele und Launcher sind davon nicht
                      betroffen.
                    </div>
                    {uninstallNote && <div className="set-row-note warn">{uninstallNote}</div>}
                  </div>
                  {confirmUninstall ? (
                    <div className="set-row-actions">
                      <div className="set-row-desc uninstall-explain">
                        {deleteData ? (
                          <>
                            buffd und <strong>alle deine Daten</strong> (Spielzeit, Statistik,
                            Einstellungen) werden gelöscht. Das lässt sich nicht rückgängig machen.
                          </>
                        ) : (
                          <>
                            Nur das Programm wird entfernt. Deine Daten (Spielzeit, Statistik,
                            Einstellungen) <strong>bleiben erhalten</strong>
                            {installInfo ? ` in ${installInfo.dataDir}` : ''}.
                          </>
                        )}
                      </div>
                      <label className="uninstall-data-opt">
                        <input
                          type="checkbox"
                          checked={deleteData}
                          onChange={(e) => setDeleteData(e.target.checked)}
                        />
                        Meine buffd-Daten (Spielzeit &amp; Einstellungen) auch löschen
                      </label>
                      <div className="settings-row-actions-row">
                        <button className="btn danger" onClick={doUninstall}>
                          Ja, deinstallieren
                        </button>
                        <button
                          className="btn"
                          onClick={() => {
                            setConfirmUninstall(false)
                            setDeleteData(false)
                          }}
                        >
                          Abbrechen
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="btn danger"
                      onClick={() => {
                        setUninstallNote(null)
                        setConfirmUninstall(true)
                      }}
                    >
                      <Trash2 size={16} /> Deinstallieren
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {section === 'ueber' && (
            <>
              <div className="set-panel-head">
                <h2>Über buffd</h2>
                <p className="set-panel-desc">
                  {appVersion ? `Aktuell installiert: buffd v${appVersion}. ` : ''}Was sich in den
                  Versionen geändert hat:
                </p>
              </div>
              <div className="set-changelog-embed">
                <ChangelogView embedded />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default SettingsView

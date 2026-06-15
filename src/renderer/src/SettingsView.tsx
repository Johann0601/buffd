import { useState } from 'react'
import { Settings, User, HardDrive, MonitorCog, ScrollText, Trash2, ChevronRight } from 'lucide-react'
import AccountsView from './AccountsView'
import ChangelogView from './ChangelogView'
import StorageView from './StorageView'
import SystemView from './SystemView'
import type { Theme, View } from './App'

// Einstellungen: bündelt die selteneren Bereiche (Konten, System/Treiber,
// Changelog) und App-Optionen wie den Hell-/Dunkel-Modus.
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
  const back = (): void => onNavigate('settings')

  // Deinstallieren: Rückfrage-Zustand + Hinweis (z. B. im Experimentier-Build).
  const [confirmUninstall, setConfirmUninstall] = useState(false)
  const [uninstallNote, setUninstallNote] = useState<string | null>(null)
  const doUninstall = async (): Promise<void> => {
    const res = await window.api.uninstallApp()
    if (!res.ok) {
      setConfirmUninstall(false)
      setUninstallNote(
        res.reason === 'experimental'
          ? 'Deinstallieren geht nur in der installierten Version — dies ist ein experimenteller Build.'
          : 'Deinstallieren nicht möglich.'
      )
    }
    // bei Erfolg startet der Uninstaller und die App beendet sich von selbst.
  }

  if (view === 'settings-accounts') return <AccountsView onBack={back} />
  if (view === 'settings-storage') return <StorageView onBack={back} />
  if (view === 'settings-system') return <SystemView onBack={back} />
  if (view === 'settings-changelog') return <ChangelogView onBack={back} />

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1 className="h2-icon">
            <Settings size={22} /> Einstellungen
          </h1>
        </div>
      </header>

      <main className="content">
        {/* App-Optionen */}
        <h2 className="section-title">Darstellung</h2>
        <div className="settings-row">
          <div className="settings-row-main">
            <div className="settings-row-title">Darkmode</div>
            <div className="settings-row-desc">
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

        {/* Bereiche */}
        <h2 className="section-title" style={{ marginTop: 26 }}>
          Bereiche
        </h2>
        <div className="settings-list">
          <button className="settings-row clickable" onClick={() => onNavigate('settings-accounts')}>
            <span className="settings-row-icon">
              <User size={22} />
            </span>
            <div className="settings-row-main">
              <div className="settings-row-title">Konten</div>
              <div className="settings-row-desc">
                Epic-Konto sowie Keys für Steam-Erfolge, SteamGridDB-Cover und Preisvergleich
              </div>
            </div>
            <span className="settings-row-arrow">
              <ChevronRight size={18} />
            </span>
          </button>
          <button className="settings-row clickable" onClick={() => onNavigate('settings-storage')}>
            <span className="settings-row-icon">
              <HardDrive size={22} />
            </span>
            <div className="settings-row-main">
              <div className="settings-row-title">Speicher verwalten</div>
              <div className="settings-row-desc">
                Größe aller Spiele und Aufräum-Vorschläge: groß &amp; lange nicht gespielt
              </div>
            </div>
            <span className="settings-row-arrow">
              <ChevronRight size={18} />
            </span>
          </button>
          <button className="settings-row clickable" onClick={() => onNavigate('settings-system')}>
            <span className="settings-row-icon">
              <MonitorCog size={22} />
            </span>
            <div className="settings-row-main">
              <div className="settings-row-title">System / Treiber</div>
              <div className="settings-row-desc">
                Hardware mit Treiberversionen und Nvidia-Update-Prüfung
              </div>
            </div>
            <span className="settings-row-arrow">
              <ChevronRight size={18} />
            </span>
          </button>
          <button
            className="settings-row clickable"
            onClick={() => onNavigate('settings-changelog')}
          >
            <span className="settings-row-icon">
              <ScrollText size={22} />
            </span>
            <div className="settings-row-main">
              <div className="settings-row-title">Changelog</div>
              <div className="settings-row-desc">Was sich in der App geändert hat</div>
            </div>
            <span className="settings-row-arrow">
              <ChevronRight size={18} />
            </span>
          </button>
        </div>

        {/* App-Verwaltung */}
        <h2 className="section-title" style={{ marginTop: 26 }}>
          App
        </h2>
        <div className="settings-row">
          <div className="settings-row-main">
            <div className="settings-row-title">buffd deinstallieren</div>
            <div className="settings-row-desc">
              Entfernt buffd von diesem PC. Deine Spiele und Launcher sind davon nicht betroffen.
            </div>
            {uninstallNote && <div className="manage-warn">{uninstallNote}</div>}
          </div>
          {confirmUninstall ? (
            <div className="settings-row-actions">
              <button className="btn danger" onClick={doUninstall}>
                Ja, deinstallieren
              </button>
              <button className="btn" onClick={() => setConfirmUninstall(false)}>
                Abbrechen
              </button>
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
      </main>
    </div>
  )
}

export default SettingsView

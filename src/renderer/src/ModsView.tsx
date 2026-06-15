import { useState, type ReactNode } from 'react'
import { Puzzle, Wrench, Box, ArrowRight } from 'lucide-react'
import MinecraftView from './MinecraftView'
import WotModsView from './WotModsView'

interface ModSection {
  id: string
  title: string
  Icon: typeof Wrench
  description: string
  render: (onBack: () => void) => JSX.Element
}

/**
 * Registry aller Spiele mit Mod-Bereich.
 * Ein NEUES Spiel ergänzen = hier einen Eintrag hinzufügen (id, Titel, Icon,
 * Beschreibung und die View-Komponente) — sonst ist nichts nötig.
 */
const MOD_SECTIONS: ModSection[] = [
  {
    id: 'wot',
    title: 'World of Tanks',
    Icon: Wrench,
    description: 'Mods an-/ausschalten, neue hinzufügen und nach Spiel-Updates wiederherstellen.',
    render: (onBack) => <WotModsView onBack={onBack} />
  },
  {
    id: 'minecraft',
    title: 'Minecraft',
    Icon: Box,
    description: 'Modpacks & Profile aus Modrinth, CurseForge und FTB App.',
    render: (onBack) => <MinecraftView onBack={onBack} />
  }
]

function ModsView({ tabs }: { tabs?: ReactNode }): JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = MOD_SECTIONS.find((s) => s.id === selectedId)

  // Ein Spiel ist gewählt -> dessen Mod-Bereich anzeigen.
  if (selected) {
    return selected.render(() => setSelectedId(null))
  }

  // Auswahl-Übersicht.
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1 className="h2-icon">
            <Puzzle size={22} /> Mods
          </h1>
          <span className="subtitle">Spiel auswählen</span>
        </div>
        {tabs}
      </header>

      <main className="content">
        <div className="mod-section-grid">
          {MOD_SECTIONS.map((s) => (
            <button key={s.id} className="mod-section-card" onClick={() => setSelectedId(s.id)}>
              <span className="mod-section-icon">
                <s.Icon size={26} />
              </span>
              <span className="mod-section-title">{s.title}</span>
              <span className="mod-section-desc">{s.description}</span>
              <span className="mod-section-cta icon-line">
                Öffnen <ArrowRight size={14} />
              </span>
            </button>
          ))}
        </div>
        <p className="hint">Weitere Spiele mit Mod-Verwaltung können hier später ergänzt werden.</p>
      </main>
    </div>
  )
}

export default ModsView

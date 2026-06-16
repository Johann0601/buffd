import {
  Library,
  BarChart3,
  ShoppingCart,
  Newspaper,
  Users,
  Bell,
  Music,
  MessageSquare,
  Settings,
  RefreshCw
} from 'lucide-react'
import logoUrl from '@/assets/logo.svg'

// Eine maßstabsgetreue Nachbildung der echten buffd-Oberfläche (Bibliothek).
// Farben, Reihenfolge der Menüpunkte, Cover-Format (2:3) und Topbar entsprechen
// der App: Akzent #6c8cff, Inhalt #0f1117, Seitenleiste #0c0e14.

const NAV_TOP = [
  { icon: Library, label: 'Bibliothek', active: true },
  { icon: BarChart3, label: 'Statistik' },
  { icon: ShoppingCart, label: 'Shops' },
  { icon: Newspaper, label: 'News' },
  { icon: Users, label: 'Freunde' }
]
const NAV_BOTTOM = [
  { icon: Bell, label: 'Benachrichtigungen' },
  { icon: Music, label: 'Spotify' },
  { icon: MessageSquare, label: 'Feedback' },
  { icon: Settings, label: 'Einstellungen' }
]

const LAUNCHERS = ['Steam', 'Epic Games', 'Battle.net']

const GAMES = [
  { name: 'Cyberpunk 2077', time: '142 h', g: 'linear-gradient(135deg,#5b2a86,#c0392b)' },
  { name: 'Elden Ring', time: '88 h', g: 'linear-gradient(135deg,#1f4287,#2c7873)' },
  { name: 'Counter-Strike 2', time: '63 h', g: 'linear-gradient(135deg,#c0392b,#e67e22)' },
  { name: "Baldur's Gate 3", time: '51 h', g: 'linear-gradient(135deg,#16222a,#3a6073)' },
  { name: 'Hades', time: '37 h', g: 'linear-gradient(135deg,#41295a,#2f0743)' },
  { name: 'Hollow Knight', time: '24 h', g: 'linear-gradient(135deg,#134e5e,#71b280)' },
  { name: 'Forza Horizon 5', time: '19 h', g: 'linear-gradient(135deg,#232526,#414345)' },
  { name: 'Stardew Valley', time: '12 h', g: 'linear-gradient(135deg,#4b134f,#c94b4b)' },
  { name: 'The Witcher 3', time: '8 h', g: 'linear-gradient(135deg,#373b44,#4286f4)' },
  { name: 'Minecraft', time: '5 h', g: 'linear-gradient(135deg,#0f9b0f,#000000)' }
]

export default function AppPreview(): JSX.Element {
  return (
    <div className="mx-auto mt-14 max-w-5xl overflow-hidden rounded-2xl border border-border bg-[#0f1117] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.85)] ring-1 ring-white/5">
      {/* schmale Fensterleiste */}
      <div className="flex items-center gap-2 border-b border-[#1c2030] bg-[#0c0e14] px-4 py-2.5">
        <img src={logoUrl} alt="" className="h-4 w-4" />
        <span className="text-[12px] font-semibold tracking-tight text-[#e6e8ee]">
          buff<span className="text-[#a855f7]">d</span>
        </span>
      </div>

      <div className="flex min-h-[360px] text-left">
        {/* Seitenleiste */}
        <aside className="hidden w-[190px] shrink-0 flex-col gap-1 border-r border-[#1c2030] bg-[#0c0e14] p-3 sm:flex">
          <div className="mb-2 flex items-center gap-2.5 px-2 py-1.5">
            <img src={logoUrl} alt="" className="h-6 w-6" />
            <span className="text-[15px] font-bold text-[#e6e8ee]">
              buff<span className="text-[#a855f7]">d</span>
            </span>
          </div>
          {NAV_TOP.map(({ icon: Icon, label, active }) => (
            <div
              key={label}
              className={
                'flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] ' +
                (active ? 'bg-[#6c8cff]/15 font-medium text-[#e6e8ee]' : 'text-[#9aa3b2]')
              }
            >
              <Icon size={17} className={active ? 'text-[#6c8cff]' : ''} />
              {label}
            </div>
          ))}
          <div className="mt-auto flex flex-col gap-1">
            {NAV_BOTTOM.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-[#9aa3b2]"
              >
                <Icon size={17} />
                {label}
              </div>
            ))}
            <span className="mt-2 px-3 text-[11px] text-[#6b7385]">Version 0.21.8</span>
          </div>
        </aside>

        {/* Inhalt */}
        <div className="min-w-0 flex-1">
          {/* Topbar */}
          <div className="flex h-[60px] items-center justify-between gap-3 border-b border-[#262b39] px-5">
            <div className="flex items-baseline gap-2.5">
              <h3 className="text-[18px] font-semibold text-[#e6e8ee]">Bibliothek</h3>
              <span className="text-[12px] text-[#9aa3b2]">126 Spiele</span>
            </div>
            <div className="hidden items-center gap-1 rounded-lg border border-[#262b39] p-1 md:flex">
              <span className="rounded-md bg-[#1f2330] px-3 py-1 text-[12px] font-medium text-[#e6e8ee]">
                Spiele
              </span>
              <span className="px-3 py-1 text-[12px] text-[#9aa3b2]">Updates</span>
              <span className="px-3 py-1 text-[12px] text-[#9aa3b2]">Mods</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-[#262b39] bg-[#181b24] px-3 py-1.5 text-[12px] text-[#e6e8ee]">
              <RefreshCw size={13} /> Aktualisieren
            </div>
          </div>

          <div className="p-5">
            {/* Launcher */}
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#9aa3b2]">
              Launcher
            </div>
            <div className="mb-5 flex flex-wrap gap-2">
              {LAUNCHERS.map((l) => (
                <span
                  key={l}
                  className="rounded-lg border border-[#262b39] bg-[#181b24] px-3 py-1.5 text-[12px] text-[#c3cad6]"
                >
                  {l}
                </span>
              ))}
            </div>

            {/* Spiele */}
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[#9aa3b2]">
              Spiele
            </div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {GAMES.map((game) => (
                <div
                  key={game.name}
                  className="overflow-hidden rounded-xl border border-[#262b39] bg-[#181b24]"
                >
                  <div className="relative aspect-[2/3]" style={{ backgroundImage: game.g }}>
                    <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-[#f0f2f7] backdrop-blur-sm">
                      {game.time}
                    </span>
                  </div>
                  <div className="px-2 py-1.5">
                    <div className="truncate text-[11px] font-medium text-[#e6e8ee]">{game.name}</div>
                    <div className="mt-0.5 text-[10px] text-[#9aa3b2]">Zuletzt: gestern</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

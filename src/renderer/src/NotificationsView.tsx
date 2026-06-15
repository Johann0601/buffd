import {
  Bell,
  RefreshCw,
  Check,
  CircleArrowUp,
  MonitorCog,
  Gift,
  Wallet,
  Gamepad2,
  ExternalLink,
  X
} from 'lucide-react'
import type { EpicFreeGame, GameCard, NvidiaUpdate, WishlistItem } from '@shared/types'
import { formatEuro } from './format'
import { updateActionFor } from './updateAction'

// Benachrichtigungen: alles Wichtige an einem Ort — App-Update (bereit zum
// Neustart), Spiel-Updates, Nvidia-Treiber, Wunschlisten-Rabatte und nicht
// eingelöste Epic-Gratisspiele.
function NotificationsView({
  appUpdateVersion,
  pendingGames,
  nvidia,
  wishlistDeals,
  epicFreebies,
  onDismissFreebie,
  onRefresh,
  refreshing
}: {
  appUpdateVersion: string | null
  pendingGames: GameCard[]
  nvidia: NvidiaUpdate | null
  wishlistDeals: WishlistItem[]
  epicFreebies: EpicFreeGame[]
  onDismissFreebie: (title: string) => void
  onRefresh: () => void
  refreshing: boolean
}): JSX.Element {
  const count =
    (appUpdateVersion ? 1 : 0) +
    pendingGames.length +
    (nvidia?.updateAvailable ? 1 : 0) +
    wishlistDeals.length +
    epicFreebies.length

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1 className="h2-icon">
            <Bell size={22} /> Benachrichtigungen
          </h1>
          <span className="subtitle">
            {count === 0 ? 'nichts offen' : `${count} offen`}
          </span>
        </div>
        <button className="btn" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? (
            'Prüfe …'
          ) : (
            <>
              <RefreshCw size={15} /> Aktualisieren
            </>
          )}
        </button>
      </header>

      <main className="content">
        {count === 0 && (
          <div className="empty icon-line">
            <Check size={16} /> Alles ruhig — App, Spiele und Treiber sind auf dem neuesten Stand.
          </div>
        )}

        <div className="settings-list">
          {/* App-Update: schon heruntergeladen, wartet auf Neustart */}
          {appUpdateVersion && (
            <div className="settings-row notif-attention">
              <span className="settings-row-icon">
                <CircleArrowUp size={22} />
              </span>
              <div className="settings-row-main">
                <div className="settings-row-title">
                  buffd {appUpdateVersion} ist bereit
                </div>
                <div className="settings-row-desc">
                  Das App-Update wurde bereits heruntergeladen — die App startet zum Installieren
                  nur kurz neu.
                </div>
              </div>
              <button className="btn primary small" onClick={() => window.api.installAppUpdate()}>
                Jetzt neu starten
              </button>
            </div>
          )}

          {/* Nvidia-Treiber */}
          {nvidia?.updateAvailable && (
            <div className="settings-row notif-attention">
              <span className="settings-row-icon">
                <MonitorCog size={22} />
              </span>
              <div className="settings-row-main">
                <div className="settings-row-title">
                  Nvidia-Treiber {nvidia.latestVersion} verfügbar
                </div>
                <div className="settings-row-desc">
                  Installiert ist {nvidia.installedVersion}. Das Update machst du wie gewohnt in
                  der NVIDIA App — die Hub-App installiert keine Treiber.
                </div>
              </div>
              <button
                className="btn small"
                onClick={async () => {
                  const opened = await window.api.openNvidiaApp()
                  if (!opened && nvidia.downloadUrl) window.open(nvidia.downloadUrl, '_blank')
                }}
              >
                NVIDIA App öffnen
              </button>
            </div>
          )}

          {/* Epic-Gratisspiele, die noch nicht eingelöst sind */}
          {epicFreebies.map((f) => (
            <div key={f.title} className="settings-row notif-attention">
              <span className="settings-row-icon">
                <Gift size={22} />
              </span>
              <div className="settings-row-main">
                <div className="settings-row-title">Gratis bei Epic: {f.title}</div>
                <div className="settings-row-desc">
                  Noch nicht in deiner Bibliothek — einmal kostenlos einlösen, dauerhaft behalten.
                  {f.endDate
                    ? ` Nur bis ${new Date(f.endDate * 1000).toLocaleDateString('de-DE', {
                        day: 'numeric',
                        month: 'long'
                      })}!`
                    : ''}
                </div>
              </div>
              {f.storeUrl && (
                <button className="btn primary small" onClick={() => window.open(f.storeUrl!, '_blank')}>
                  Im Epic Store einlösen <ExternalLink size={14} />
                </button>
              )}
              <button
                className="btn small icon-only"
                title="Diese Erinnerung ausblenden"
                onClick={() => onDismissFreebie(f.title)}
              >
                <X size={15} />
              </button>
            </div>
          ))}

          {/* Wunschlisten-Spiele im Angebot */}
          {wishlistDeals.map((w) => (
            <div key={w.appId} className="settings-row notif-attention">
              <span className="settings-row-icon">
                <Wallet size={22} />
              </span>
              <div className="settings-row-main">
                <div className="settings-row-title">
                  {w.name} ist im Angebot (−{w.discountPct} %)
                </div>
                <div className="settings-row-desc">
                  Jetzt {w.priceCents !== null ? formatEuro(w.priceCents) : '—'}
                  {w.originalCents !== null ? ` statt ${formatEuro(w.originalCents)}` : ''} — von
                  deiner Wunschliste.
                </div>
              </div>
              <button
                className="btn small"
                onClick={() =>
                  window.open(
                    w.storeUrl ?? `https://store.steampowered.com/app/${w.appId}/`,
                    '_blank'
                  )
                }
              >
                {w.shop === 'epic' ? (
                  <>
                    Im Epic Store <ExternalLink size={14} />
                  </>
                ) : (
                  <>
                    Im Steam-Store <ExternalLink size={14} />
                  </>
                )}
              </button>
            </div>
          ))}

          {/* Spiel-Updates (Steam & Battle.net) */}
          {pendingGames.map((g) => {
            const action = updateActionFor(g)
            return (
              <div key={g.id} className="settings-row">
                <span className="settings-row-icon">
                  <Gamepad2 size={22} />
                </span>
                <div className="settings-row-main">
                  <div className="settings-row-title">{g.name}</div>
                  <div className="settings-row-desc">
                    Für dieses Spiel steht ein Update aus (
                    {g.platform === 'battlenet' ? 'Battle.net' : 'Steam'}).
                  </div>
                </div>
                {action && (
                  <button className="btn small" onClick={action.run}>
                    {action.label}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <p className="hint">
          Hier landet alles Wichtige: App-Updates, Spiel-Updates, Nvidia-Treiber,
          Wunschlisten-Rabatte (Preisprüfung alle 6 Stunden) und Epic-Gratisspiele, die du noch
          nicht eingelöst hast. Mit „Aktualisieren" oben prüfst du alles sofort neu.
        </p>
      </main>
    </div>
  )
}

export default NotificationsView

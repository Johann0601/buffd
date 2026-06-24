/**
 * Ladescreen/Splash beim Start. Liegt als Vollbild-Overlay über der App, während
 * der Hauptprozess die erste App-Update-Prüfung macht (siehe App.tsx „boot"-Effekt).
 * Reiner CSS-/SVG-Look nach Entwurf `Claude_Design/.../Loading Screen` — Wortmarke,
 * animiertes Hexagon-Netzwerk, Status-Label und indeterminierter Fortschrittsbalken.
 */
function Splash({
  fading,
  statusLabel = 'Suche nach Updates',
  sourceLabel = 'Steam · Epic · Battle.net · Minecraft'
}: {
  fading: boolean
  statusLabel?: string
  sourceLabel?: string
}): JSX.Element {
  return (
    <div className={`splash ${fading ? 'splash-hide' : ''}`}>
      <div className="splash-wordmark">
        buff<span>d</span>
      </div>

      <div className="splash-logo">
        <div className="splash-glow" />

        {/* Rotierender Akzent-Ring */}
        <svg className="splash-spin" viewBox="-100 -100 200 200" width="300" height="300">
          <circle cx="0" cy="0" r="72" fill="none" stroke="rgba(168,85,247,.10)" strokeWidth="1.5" />
          <circle
            cx="0"
            cy="0"
            r="72"
            fill="none"
            stroke="#a855f7"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="70 452"
            style={{ filter: 'drop-shadow(0 0 6px rgba(168,85,247,.8))' }}
          />
          <circle
            cx="0"
            cy="0"
            r="72"
            fill="none"
            stroke="#a855f7"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="20 226"
            strokeDashoffset="-238"
            opacity=".5"
          />
        </svg>

        {/* Hexagon + drei Knoten + Mittel-Ring (Netzwerk-Motiv) */}
        <svg className="splash-hex" viewBox="-100 -100 200 200" width="300" height="300">
          <path
            d="M0 -84 L73 -42 L73 42 L0 84 L-73 42 L-73 -42 Z"
            fill="rgba(168,85,247,.03)"
            stroke="#a855f7"
            strokeWidth="4.5"
            strokeLinejoin="miter"
          />
          <line x1="0" y1="-15" x2="0" y2="-44" stroke="#a855f7" strokeWidth="6" strokeLinecap="round" className="splash-line" style={{ animationDelay: '0s' }} />
          <line x1="13" y1="7.5" x2="39" y2="22" stroke="#a855f7" strokeWidth="6" strokeLinecap="round" className="splash-line" style={{ animationDelay: '.45s' }} />
          <line x1="-13" y1="7.5" x2="-39" y2="22" stroke="#a855f7" strokeWidth="6" strokeLinecap="round" className="splash-line" style={{ animationDelay: '.9s' }} />
          <circle cx="0" cy="-47" r="10.5" fill="#a855f7" className="splash-node" style={{ animationDelay: '0s' }} />
          <circle cx="41" cy="24" r="10.5" fill="#a855f7" className="splash-node" style={{ animationDelay: '.45s' }} />
          <circle cx="-41" cy="24" r="10.5" fill="#a855f7" className="splash-node" style={{ animationDelay: '.9s' }} />
          <circle cx="0" cy="0" r="9.5" fill="none" stroke="#a855f7" strokeWidth="6" className="splash-mid-ring" />
        </svg>
      </div>

      <div className="splash-status">
        <span>{statusLabel}</span>
        <span className="splash-dots">
          <span style={{ animationDelay: '0s' }} />
          <span style={{ animationDelay: '.2s' }} />
          <span style={{ animationDelay: '.4s' }} />
        </span>
      </div>

      <div className="splash-bar">
        <div className="splash-bar-fill" />
      </div>

      <div className="splash-source">{sourceLabel}</div>
    </div>
  )
}

export default Splash

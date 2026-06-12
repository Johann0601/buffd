import type { Platform } from '@shared/types'

/**
 * "Deinstallieren"-Aktion je Plattform. Die App löscht NIE selbst Ordner:
 *  - Steam hat ein offizielles Kommando -> öffnet Steams eigenen
 *    Deinstallations-Dialog (mit Bestätigung durch den Nutzer).
 *  - Alle anderen Launcher bieten kein Kommando -> wir öffnen den Launcher
 *    und sagen per Hinweis, wo es dort geht.
 * null = für diese Plattform gibt es keine sinnvolle Aktion.
 */
export function uninstallActionFor(
  platform: Platform,
  platformId: string
): { run: () => void; hint: string | null } | null {
  if (platform === 'steam') {
    return {
      run: () => window.open(`steam://uninstall/${platformId}`, '_blank'),
      hint: null // Steam zeigt selbst einen Bestätigungs-Dialog
    }
  }

  // Launcher ohne Deinstallations-Kommando: Launcher öffnen + erklären, wo es geht.
  const hints: Partial<Record<Platform, string>> = {
    epic: 'Epic-Launcher geöffnet — in der Bibliothek auf die drei Punkte (···) am Spiel klicken → Deinstallieren.',
    battlenet:
      'Battle.net geöffnet — beim Spiel auf das Zahnrad ⚙ neben dem Spielen-Knopf klicken → Deinstallieren.',
    ubisoft:
      'Ubisoft Connect geöffnet — Rechtsklick auf das Spiel in der Bibliothek → Deinstallieren.',
    riot: 'Riot Client geöffnet — Profilbild → Einstellungen → beim Spiel auf Deinstallieren klicken.',
    rsi: 'RSI Launcher geöffnet — Einstellungen (Zahnrad) → Spieleinstellungen → Deinstallieren.'
  }
  const hint = hints[platform]
  if (!hint) return null

  return {
    run: () => window.api.openPlatformLauncher(platform),
    hint
  }
}

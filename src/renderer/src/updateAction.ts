import type { GameCard } from '@shared/types'

/**
 * Liefert die passende "Update machen"-Aktion für ein Spiel — je nach
 * Plattform. Die App installiert nie selbst; sie führt nur zum richtigen
 * Launcher. null = für diese Plattform gibt es keine Update-Aktion.
 */
export function updateActionFor(game: GameCard): { label: string; run: () => void } | null {
  if (game.platform === 'steam') {
    return {
      label: 'In Steam aktualisieren',
      run: () => window.open(`steam://nav/games/details/${game.platformId}`, '_blank')
    }
  }
  if (game.platform === 'battlenet') {
    return {
      label: 'Battle.net öffnen',
      run: () => window.api.openPlatformLauncher('battlenet')
    }
  }
  return null
}

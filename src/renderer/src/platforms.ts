import type { Platform } from '@shared/types'

/** Anzeige-Namen der Plattformen (für Filter, Listen, Hinweise). */
export const PLATFORM_LABEL: Partial<Record<Platform, string>> = {
  steam: 'Steam',
  epic: 'Epic Games',
  battlenet: 'Battle.net',
  ubisoft: 'Ubisoft',
  riot: 'Riot Games',
  rsi: 'RSI',
  ea: 'EA',
  rockstar: 'Rockstar',
  wargaming: 'Wargaming',
  xbox: 'Xbox',
  modrinth: 'Modrinth',
  curseforge: 'CurseForge',
  ftb: 'FTB'
}

/** Anzeige-Name einer Plattform (mit Rückfall auf den internen Namen). */
export function platformLabel(platform: Platform): string {
  return PLATFORM_LABEL[platform] ?? platform
}

// Eingebaute Standard-API-Keys: werden zur Build-Zeit aus der (gitignored)
// .env injiziert, damit SteamGridDB-Cover und IsThereAnyDeal-Preise OHNE
// eigenen Key funktionieren. Ein in den Konten hinterlegter Key hat Vorrang.
//
// Bewusste Abwägung: ein eingebauter Key ist aus der App extrahierbar — bei
// SGDB/ITAD unkritisch (kostenlose App-Keys, jederzeit neu generierbar).
// Der Steam-Web-API-Key wird NICHT eingebaut (persönlich + Steam-Bedingungen).

export const BUILTIN_SGDB_KEY: string | null =
  import.meta.env.MAIN_VITE_SGDB_KEY?.trim() || null

export const BUILTIN_ITAD_KEY: string | null =
  import.meta.env.MAIN_VITE_ITAD_KEY?.trim() || null

// Spotify-Client-ID (PKCE-Flow — KEIN Secret nötig, daher unkritisch einbettbar).
export const BUILTIN_SPOTIFY_CLIENT_ID: string | null =
  import.meta.env.MAIN_VITE_SPOTIFY_CLIENT_ID?.trim() || null

// Discord-Webhook-URL für die In-App-Feedback-/Bug-Report-Funktion. Erlaubt nur
// das Schreiben in genau einen Kanal; jederzeit in Discord neu generierbar.
export const BUILTIN_FEEDBACK_WEBHOOK: string | null =
  import.meta.env.MAIN_VITE_FEEDBACK_WEBHOOK?.trim() || null

// read-feedback.mjs
// Liest die letzten Nachrichten aus dem Discord-Feedback-Channel.
//
// Läuft KOMPLETT außerhalb des App-Builds (kein Vite, kein MAIN_VITE_-Präfix),
// daher landet der Bot-Token NICHT in einem Release.
//
// Voraussetzungen in der (gitignored) .env im Projekt-Root:
//   DISCORD_BOT_TOKEN=...            (Bot-Token, NICHT der Webhook!)
//   DISCORD_FEEDBACK_CHANNEL_ID=...  (Channel-ID, Rechtsklick auf Channel -> ID kopieren)
//
// Aufruf:
//   node scripts/read-feedback.mjs            -> letzte 25 Nachrichten
//   node scripts/read-feedback.mjs 50         -> letzte 50 Nachrichten (max 100)
//
// Node 24 hat global fetch eingebaut – keine Abhängigkeiten nötig.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ENV_PATH = join(__dirname, '..', '.env')

/** Minimaler .env-Parser (KEY=VALUE, # = Kommentar). */
function loadEnv(path) {
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    return {}
  }
  const out = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

const fileEnv = loadEnv(ENV_PATH)
const TOKEN = process.env.DISCORD_BOT_TOKEN || fileEnv.DISCORD_BOT_TOKEN
const CHANNEL = process.env.DISCORD_FEEDBACK_CHANNEL_ID || fileEnv.DISCORD_FEEDBACK_CHANNEL_ID

if (!TOKEN || !CHANNEL) {
  console.error(
    'Fehlt: DISCORD_BOT_TOKEN und/oder DISCORD_FEEDBACK_CHANNEL_ID in der .env.\n' +
      'Beide Zeilen in C:\\Users\\johan\\Desktop\\Spiele Hub\\.env eintragen.'
  )
  process.exit(1)
}

const limitArg = parseInt(process.argv[2], 10)
const limit = Math.min(Math.max(Number.isFinite(limitArg) ? limitArg : 25, 1), 100)

const url = `https://discord.com/api/v10/channels/${CHANNEL}/messages?limit=${limit}`

const res = await fetch(url, {
  headers: { Authorization: `Bot ${TOKEN}` }
})

if (!res.ok) {
  const body = await res.text().catch(() => '')
  console.error(`Discord-API-Fehler ${res.status} ${res.statusText}\n${body}`)
  if (res.status === 401) console.error('-> Token falsch/abgelaufen?')
  if (res.status === 403)
    console.error('-> Bot fehlt die Berechtigung (View Channel / Read Message History) oder ist nicht im Server.')
  if (res.status === 404) console.error('-> Channel-ID falsch?')
  process.exit(1)
}

const messages = await res.json()
// Discord liefert neueste zuerst -> für Lesefluss umdrehen (älteste oben).
messages.reverse()

if (messages.length === 0) {
  console.log('(keine Nachrichten im Channel)')
  process.exit(0)
}

const fmt = (iso) => new Date(iso).toLocaleString('de-DE')

for (const m of messages) {
  const author = m.author?.username ?? 'unbekannt'
  console.log('────────────────────────────────────────')
  console.log(`[${fmt(m.timestamp)}] ${author}`)
  if (m.content) console.log(m.content)

  for (const e of m.embeds ?? []) {
    if (e.title) console.log(`  • Titel: ${e.title}`)
    if (e.description) console.log(`  • ${e.description}`)
    for (const f of e.fields ?? []) console.log(`  • ${f.name}: ${f.value}`)
  }

  for (const a of m.attachments ?? []) {
    console.log(`  📎 ${a.filename} -> ${a.url}`)
  }
}
console.log('────────────────────────────────────────')
console.log(`(${messages.length} Nachricht(en))`)

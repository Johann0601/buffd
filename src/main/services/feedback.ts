// In-App-Feedback / Bug-Reports: schickt eine formatierte Nachricht an einen
// privaten Discord-Kanal (per Webhook). Die Webhook-URL wird zur Build-Zeit aus
// der .env eingebacken (siehe builtinKeys). Es werden NUR die Angaben gesendet,
// die der Nutzer sieht: Art, Text sowie App- und Windows-Version.

import { app, net } from 'electron'
import { release } from 'os'
import { BUILTIN_FEEDBACK_WEBHOOK } from './builtinKeys'

export type FeedbackKind = 'bug' | 'idea' | 'other'

/** Maximale Anhang-Größe (8 MB — liegt sicher unter Discords Webhook-Limit). */
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024

export interface FeedbackAttachment {
  name: string
  mime: string
  data: Uint8Array
}

interface KindMeta {
  label: string
  color: number
}

const KINDS: Record<FeedbackKind, KindMeta> = {
  bug: { label: '🐞 Bug', color: 0xe74c3c },
  idea: { label: '💡 Vorschlag', color: 0x5865f2 },
  other: { label: '💬 Sonstiges', color: 0x95a5a6 }
}

export interface FeedbackResult {
  ok: boolean
  reason?: 'noconfig' | 'empty' | 'error' | 'toobig' | 'ratelimited'
  retryAfterMs?: number // bei 'ratelimited': verbleibende Wartezeit
}

/** Spamschutz: höchstens eine erfolgreiche Nachricht pro Minute. */
const RATE_LIMIT_MS = 60_000
let lastSentAt = 0

/** Den NT-Kernel (z. B. „10.0.26200") in einen lesbaren Windows-Namen umwandeln.
 *  Windows 11 meldet weiterhin Major 10, ist aber an Build >= 22000 erkennbar. */
function windowsLabel(): string {
  const rel = release()
  const build = Number(rel.split('.')[2])
  if (!Number.isFinite(build)) return `Windows ${rel}`
  return `${build >= 22000 ? 'Windows 11' : 'Windows 10'} (Build ${build})`
}

/** Eine Feedback-Nachricht (optional mit Anhang) an den Discord-Webhook senden. */
export async function sendFeedback(
  kind: FeedbackKind,
  message: string,
  attachment?: FeedbackAttachment
): Promise<FeedbackResult> {
  if (!BUILTIN_FEEDBACK_WEBHOOK) return { ok: false, reason: 'noconfig' }
  const text = (message ?? '').trim()
  if (!text) return { ok: false, reason: 'empty' }
  if (attachment && attachment.data.byteLength > MAX_ATTACHMENT_BYTES) {
    return { ok: false, reason: 'toobig' }
  }
  // Spamschutz: nur eine erfolgreiche Nachricht pro Minute.
  const sinceLast = Date.now() - lastSentAt
  if (sinceLast < RATE_LIMIT_MS) {
    return { ok: false, reason: 'ratelimited', retryAfterMs: RATE_LIMIT_MS - sinceLast }
  }

  const meta = KINDS[kind] ?? KINDS.other
  const payload = {
    username: 'buffd Feedback',
    embeds: [
      {
        title: meta.label,
        description: text.slice(0, 4000), // Discord-Limit
        color: meta.color,
        fields: [
          { name: 'Version', value: `buffd ${app.getVersion()}`, inline: true },
          { name: 'System', value: windowsLabel(), inline: true }
        ],
        timestamp: new Date().toISOString()
      }
    ]
  }

  try {
    if (attachment) {
      // Mit Anhang -> multipart/form-data (payload_json + Datei). Node-fetch kann
      // FormData/Blob; Discord akzeptiert das an der Webhook-URL.
      const form = new FormData()
      form.append('payload_json', JSON.stringify(payload))
      form.append(
        'files[0]',
        new Blob([attachment.data as unknown as BlobPart], {
          type: attachment.mime || 'application/octet-stream'
        }),
        attachment.name
      )
      const res = await fetch(BUILTIN_FEEDBACK_WEBHOOK, { method: 'POST', body: form })
      if (res.ok) lastSentAt = Date.now()
      return res.ok ? { ok: true } : { ok: false, reason: 'error' }
    }
    const res = await net.fetch(BUILTIN_FEEDBACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (res.ok) lastSentAt = Date.now()
    return res.ok ? { ok: true } : { ok: false, reason: 'error' }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

/** Ist die Feedback-Funktion in diesem Build konfiguriert (Webhook vorhanden)? */
export function feedbackAvailable(): boolean {
  return !!BUILTIN_FEEDBACK_WEBHOOK
}

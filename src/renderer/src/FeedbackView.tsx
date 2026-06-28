import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MessageSquare,
  Bug,
  Lightbulb,
  MessageCircle,
  Send,
  Check,
  TriangleAlert,
  Paperclip,
  X
} from 'lucide-react'
import { formatGameSize } from './format'

type Kind = 'bug' | 'idea' | 'other'
type Status =
  | 'idle'
  | 'sending'
  | 'sent'
  | 'empty'
  | 'error'
  | 'noconfig'
  | 'toobig'
  | 'ratelimited'

/** Maximale Anhang-Größe (8 MB — muss zur Grenze im Hauptprozess passen). */
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024

interface Attachment {
  name: string
  mime: string
  size: number
  data: Uint8Array
}

const KINDS: { id: Kind; label: string; Icon: typeof Bug }[] = [
  { id: 'bug', label: 'Bug', Icon: Bug },
  { id: 'idea', label: 'Vorschlag', Icon: Lightbulb },
  { id: 'other', label: 'Sonstiges', Icon: MessageCircle }
]

// Feedback / Bug-Reports: kurzer Text + Art, geht an einen privaten Discord-Kanal.
// App- und Windows-Version werden automatisch (und sichtbar) mitgeschickt.
function FeedbackView(): JSX.Element {
  const [kind, setKind] = useState<Kind>('bug')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [version, setVersion] = useState('')
  const [available, setAvailable] = useState(true)
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [cooldownUntil, setCooldownUntil] = useState(0) // Spamschutz: gesperrt bis (ms)
  const [nowTs, setNowTs] = useState(Date.now())
  const fileInput = useRef<HTMLInputElement>(null)

  const remaining = Math.max(0, Math.ceil((cooldownUntil - nowTs) / 1000))

  useEffect(() => {
    window.api.getAppVersion().then(setVersion).catch(() => {})
    window.api.feedbackAvailable().then(setAvailable).catch(() => {})
  }, [])

  // Countdown für den Spamschutz weiterlaufen lassen, solange gesperrt.
  useEffect(() => {
    if (cooldownUntil <= Date.now()) return
    const t = setInterval(() => setNowTs(Date.now()), 500)
    return () => clearInterval(t)
  }, [cooldownUntil])

  // Eine Datei (aus Auswahl oder Zwischenablage) als Anhang übernehmen.
  const applyFile = useCallback(async (file: File, fallbackName?: string): Promise<void> => {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachment(null)
      setStatus('toobig')
      return
    }
    const buf = await file.arrayBuffer()
    setAttachment({
      name: file.name || fallbackName || 'anhang',
      mime: file.type,
      size: file.size,
      data: new Uint8Array(buf)
    })
    setStatus((s) => (s !== 'idle' ? 'idle' : s))
  }, [])

  const pickFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    e.target.value = '' // erneutes Auswählen derselben Datei erlauben
    if (file) await applyFile(file)
  }

  // Screenshot/Bild aus der Zwischenablage per Strg+V einfügen.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent): void => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const it of items) {
        if (it.type.startsWith('image/')) {
          const file = it.getAsFile()
          if (file) {
            e.preventDefault()
            const ext = it.type.split('/')[1] || 'png'
            void applyFile(file, `screenshot-${Date.now()}.${ext}`)
          }
          return
        }
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [applyFile])

  const submit = async (): Promise<void> => {
    if (remaining > 0) return // Spamschutz (Knopf ist ohnehin gesperrt)
    if (!message.trim()) {
      setStatus('empty')
      return
    }
    setStatus('sending')
    const res = await window.api.sendFeedback(
      kind,
      message,
      attachment ? { name: attachment.name, mime: attachment.mime, data: attachment.data } : undefined
    )
    if (res.ok) {
      setStatus('sent')
      setMessage('')
      setAttachment(null)
      setCooldownUntil(Date.now() + 60_000)
    } else if (res.reason === 'ratelimited') {
      setStatus('ratelimited')
      setCooldownUntil(Date.now() + (res.retryAfterMs ?? 60_000))
    } else {
      setStatus(
        res.reason === 'noconfig'
          ? 'noconfig'
          : res.reason === 'empty'
            ? 'empty'
            : res.reason === 'toobig'
              ? 'toobig'
              : 'error'
      )
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1 className="h2-icon">
            <MessageSquare size={22} /> Feedback
          </h1>
          <span className="subtitle">Fehler melden oder Ideen vorschlagen</span>
        </div>
      </header>

      <main className="content">
        <div className="feedback-form">
          <p className="feedback-intro">
            Hier kannst du einen Fehler melden oder einen Vorschlag schicken. Die Nachricht geht
            direkt an den Entwickler.
          </p>

          <div className="feedback-kinds">
            {KINDS.map((k) => (
              <button
                key={k.id}
                className={`tag-chip icon-chip ${kind === k.id ? 'on' : ''}`}
                onClick={() => setKind(k.id)}
              >
                <k.Icon size={15} /> {k.label}
              </button>
            ))}
          </div>

          <textarea
            className="feedback-textarea"
            placeholder={
              kind === 'bug'
                ? 'Was ist passiert? Was hast du erwartet? Wie kann man es nachstellen?'
                : kind === 'idea'
                  ? 'Welche Idee oder Funktion wünschst du dir?'
                  : 'Deine Nachricht …'
            }
            value={message}
            onChange={(e) => {
              setMessage(e.target.value)
              if (status !== 'idle') setStatus('idle')
            }}
            rows={8}
          />

          <div className="feedback-attach">
            <input
              ref={fileInput}
              type="file"
              style={{ display: 'none' }}
              onChange={pickFile}
            />
            {attachment ? (
              <span className="feedback-file">
                <Paperclip size={14} />
                <span className="feedback-file-name">{attachment.name}</span>
                <span className="feedback-file-size">({formatGameSize(attachment.size)})</span>
                <button
                  className="btn small icon-only"
                  data-tip="Anhang entfernen"
                  onClick={() => setAttachment(null)}
                >
                  <X size={14} />
                </button>
              </span>
            ) : (
              <button className="btn small" onClick={() => fileInput.current?.click()}>
                <Paperclip size={15} /> Datei anhängen
              </button>
            )}
            <span className="feedback-attach-hint">
              max. 8 MB — Screenshot auch per Strg+V einfügbar
            </span>
          </div>

          <div className="feedback-meta">
            Automatisch mitgeschickt: <b>buffd {version || '–'}</b> &amp; deine Windows-Version.
            Sonst nichts.
          </div>

          <div className="feedback-actions">
            <button
              className="btn primary"
              onClick={submit}
              disabled={status === 'sending' || !available || remaining > 0}
            >
              {status === 'sending' ? (
                'Sende …'
              ) : remaining > 0 ? (
                `Erneut in ${remaining}s`
              ) : (
                <>
                  <Send size={16} /> Absenden
                </>
              )}
            </button>

            {status === 'sent' && (
              <span className="feedback-status ok icon-line">
                <Check size={16} /> Danke! Deine Nachricht wurde gesendet.
              </span>
            )}
            {status === 'empty' && (
              <span className="feedback-status warn icon-line">
                <TriangleAlert size={16} /> Bitte schreib zuerst eine kurze Nachricht.
              </span>
            )}
            {status === 'toobig' && (
              <span className="feedback-status warn icon-line">
                <TriangleAlert size={16} /> Die Datei ist zu groß (max. 8 MB).
              </span>
            )}
            {status === 'error' && (
              <span className="feedback-status warn icon-line">
                <TriangleAlert size={16} /> Senden fehlgeschlagen — bist du online?
              </span>
            )}
            {status === 'ratelimited' && remaining > 0 && (
              <span className="feedback-status warn icon-line">
                <TriangleAlert size={16} /> Bitte warte noch {remaining}s — du kannst nur einmal pro
                Minute senden.
              </span>
            )}
          </div>

          {!available && (
            <div className="banner error icon-line" style={{ marginTop: 14 }}>
              <TriangleAlert size={16} /> In diesem Build ist das Senden nicht eingerichtet.
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default FeedbackView

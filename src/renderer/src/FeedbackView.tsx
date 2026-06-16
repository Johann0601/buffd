import { useEffect, useRef, useState } from 'react'
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
type Status = 'idle' | 'sending' | 'sent' | 'empty' | 'error' | 'noconfig' | 'toobig'

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
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.api.getAppVersion().then(setVersion).catch(() => {})
    window.api.feedbackAvailable().then(setAvailable).catch(() => {})
  }, [])

  const pickFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    e.target.value = '' // erneutes Auswählen derselben Datei erlauben
    if (!file) return
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachment(null)
      setStatus('toobig')
      return
    }
    const buf = await file.arrayBuffer()
    setAttachment({
      name: file.name,
      mime: file.type,
      size: file.size,
      data: new Uint8Array(buf)
    })
    if (status !== 'idle') setStatus('idle')
  }

  const submit = async (): Promise<void> => {
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
                  title="Anhang entfernen"
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
            <span className="feedback-attach-hint">max. 8 MB (z. B. Screenshot/Logdatei)</span>
          </div>

          <div className="feedback-meta">
            Automatisch mitgeschickt: <b>buffd {version || '–'}</b> &amp; deine Windows-Version.
            Sonst nichts.
          </div>

          <div className="feedback-actions">
            <button
              className="btn primary"
              onClick={submit}
              disabled={status === 'sending' || !available}
            >
              {status === 'sending' ? (
                'Sende …'
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

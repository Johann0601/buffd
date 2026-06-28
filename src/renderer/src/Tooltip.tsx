// Globaler, ans buffd-Design angepasster Tooltip.
//
// Liest das eigene Attribut data-tip="…" (NICHT das native title), damit
// Windows nie seinen eigenen, ungestylten Tooltip zeigt. Die App nutzt überall
// data-tip statt title — dieser Controller hängt sich app-weit per Event-
// Delegation an alle solchen Elemente und zeigt eine dezente Sprechblase.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const SHOW_DELAY = 400 // ms bis der Tooltip erscheint (etwas flotter als der Browser)
const GAP = 8 // Abstand zwischen Element und Sprechblase
const MARGIN = 8 // Mindestabstand zum Fensterrand

type Anchor = { text: string; rect: DOMRect }
type Pos = { left: number; top: number; arrow: number; placement: 'top' | 'bottom' }

export default function Tooltip(): JSX.Element | null {
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const [pos, setPos] = useState<Pos | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  const trackedEl = useRef<HTMLElement | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const hide = useCallback(() => {
    window.clearTimeout(timer.current)
    trackedEl.current = null
    setAnchor(null)
    setPos(null)
  }, [])

  // Hover-Delegation: läuft immer, ist aber leichtgewichtig (mouseover/mouseout
  // feuern nur beim Wechsel über Element-Grenzen, nicht bei jeder Mausbewegung).
  useEffect(() => {
    function findTip(start: EventTarget | null): HTMLElement | null {
      let el = start as HTMLElement | null
      while (el && el !== document.body) {
        if (el.getAttribute && el.getAttribute('data-tip')) return el
        el = el.parentElement
      }
      return null
    }

    function onOver(e: MouseEvent): void {
      const el = findTip(e.target)
      if (!el) {
        if (trackedEl.current) hide()
        return
      }
      if (el === trackedEl.current) return
      window.clearTimeout(timer.current)
      trackedEl.current = el
      timer.current = window.setTimeout(() => {
        const text = el.getAttribute('data-tip') || ''
        setAnchor({ text, rect: el.getBoundingClientRect() })
      }, SHOW_DELAY)
    }

    function onOut(e: MouseEvent): void {
      if (!trackedEl.current) return
      const related = e.relatedTarget as Node | null
      if (related && trackedEl.current.contains(related)) return
      hide()
    }

    document.addEventListener('mouseover', onOver, true)
    document.addEventListener('mouseout', onOut, true)
    return () => {
      document.removeEventListener('mouseover', onOver, true)
      document.removeEventListener('mouseout', onOut, true)
      window.clearTimeout(timer.current)
    }
  }, [hide])

  // Schließen bei Scrollen/Klick — NUR solange ein Tooltip sichtbar ist, sonst
  // würden diese (beim Scrollen sehr häufigen) Events dauerhaft Last erzeugen.
  // passive: true, damit das Scrollen nicht blockiert wird.
  useEffect(() => {
    if (!anchor) return
    const passive: AddEventListenerOptions = { capture: true, passive: true }
    window.addEventListener('scroll', hide, passive)
    window.addEventListener('wheel', hide, passive)
    window.addEventListener('mousedown', hide, true)
    return () => {
      window.removeEventListener('scroll', hide, passive)
      window.removeEventListener('wheel', hide, passive)
      window.removeEventListener('mousedown', hide, true)
    }
  }, [anchor, hide])

  // Nach dem Einfügen messen und passend (mit Rand-Klemmung) positionieren.
  useLayoutEffect(() => {
    if (!anchor || !boxRef.current) {
      setPos(null)
      return
    }
    const box = boxRef.current.getBoundingClientRect()
    const r = anchor.rect
    const vw = window.innerWidth
    const vh = window.innerHeight

    const placement: 'top' | 'bottom' =
      r.top - box.height - GAP >= MARGIN || r.bottom + box.height + GAP > vh - MARGIN ? 'top' : 'bottom'
    let top = placement === 'top' ? r.top - box.height - GAP : r.bottom + GAP
    top = Math.max(MARGIN, Math.min(top, vh - box.height - MARGIN))

    const center = r.left + r.width / 2
    let left = center - box.width / 2
    left = Math.max(MARGIN, Math.min(left, vw - box.width - MARGIN))
    // Pfeil zeigt auf die Element-Mitte (relativ zur Sprechblase, geklemmt).
    const arrow = Math.max(12, Math.min(center - left, box.width - 12))

    setPos({ left, top, arrow, placement })
  }, [anchor])

  if (!anchor) return null
  return createPortal(
    <div
      ref={boxRef}
      className={`buffd-tooltip ${pos ? pos.placement : 'top'}`}
      role="tooltip"
      style={{
        left: pos ? pos.left : -9999,
        top: pos ? pos.top : -9999,
        // @ts-expect-error CSS-Custom-Property
        '--arrow-x': `${pos ? pos.arrow : 0}px`,
        visibility: pos ? 'visible' : 'hidden'
      }}
    >
      {anchor.text}
    </div>,
    document.body
  )
}

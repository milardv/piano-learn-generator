import type { Hand, Mark, Note } from './types'

const BLACK = new Set([1, 3, 6, 8, 10])
export const isBlack = (p: number) => BLACK.has(p % 12)

const COLORS: Record<Hand, { white: string; black: string }> = {
  R: { white: '#4fb3ff', black: '#1f7fcc' },
  L: { white: '#ffa04f', black: '#cc6f1f' },
}

const NAMES = ['Do', 'Do♯', 'Ré', 'Ré♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si']
export const noteName = (p: number) => NAMES[p % 12]

export interface Layout {
  first: number
  last: number
  whiteWidth: number
  keyboardTop: number
  height: number
}

/** Plage de touches affichée : celle du morceau, élargie aux touches blanches et à 2 octaves minimum. */
export function keyRange(min: number, max: number): [number, number] {
  let first = Math.max(21, min - 2)
  let last = Math.min(108, max + 2)
  while (last - first < 24) {
    first = Math.max(21, first - 1)
    last = Math.min(108, last + 1)
  }
  while (isBlack(first)) first--
  while (isBlack(last)) last++
  return [first, last]
}

export function makeLayout(first: number, last: number, width: number, height: number): Layout {
  let whites = 0
  for (let p = first; p <= last; p++) if (!isBlack(p)) whites++
  return { first, last, whiteWidth: width / whites, keyboardTop: height * 0.8, height }
}

/** Position horizontale [x, largeur] d'une touche. */
export function keyX(l: Layout, p: number): [number, number] {
  let whitesBefore = 0
  for (let k = l.first; k < p; k++) if (!isBlack(k)) whitesBefore++
  if (!isBlack(p)) return [whitesBefore * l.whiteWidth, l.whiteWidth]
  const w = l.whiteWidth * 0.6
  return [whitesBefore * l.whiteWidth - w / 2, w]
}

export function draw(
  ctx: CanvasRenderingContext2D,
  l: Layout,
  notes: Note[],
  now: number,
  pxPerSec: number,
  hidden: Set<Hand>,
  labels = false,
  marks: Mark[] = [],
) {
  const width = ctx.canvas.width
  ctx.fillStyle = '#16181d'
  ctx.fillRect(0, 0, width, l.height)

  // Repères d'octave (sur chaque Do)
  ctx.strokeStyle = '#262a33'
  for (let p = l.first; p <= l.last; p++) {
    if (p % 12 === 0) {
      const [x] = keyX(l, p)
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, l.keyboardTop)
      ctx.stroke()
    }
  }

  const horizon = now + l.keyboardTop / pxPerSec
  const active = new Map<number, Hand>()
  for (const n of notes) {
    if (n.t > horizon) break
    if (n.t + n.d < now) continue
    if (n.t <= now) active.set(n.p, n.h)
    if (hidden.has(n.h)) continue
    const [x, w] = keyX(l, n.p)
    const yBottom = l.keyboardTop - (n.t - now) * pxPerSec
    const h = n.d * pxPerSec
    ctx.fillStyle = isBlack(n.p) ? COLORS[n.h].black : COLORS[n.h].white
    roundRect(ctx, x + 1, yBottom - h, w - 2, Math.max(h, 4), 4)
    if (n.f && h >= w * 0.6) {
      // Doigté : pastille chiffrée en bas de la note
      const r = Math.min(w * 0.36, 13 * (window.devicePixelRatio || 1))
      const cy = yBottom - r - 3
      ctx.fillStyle = 'rgb(255 255 255 / 92%)'
      ctx.beginPath()
      ctx.arc(x + w / 2, cy, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#111'
      ctx.font = `700 ${r * 1.3}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(n.f), x + w / 2, cy + 1)
      ctx.textBaseline = 'alphabetic'
    } else if (labels && h >= w * 0.9) {
      const size = Math.min(Math.max(w * 0.45, 11), 22)
      ctx.fillStyle = isBlack(n.p) ? 'rgb(255 255 255 / 90%)' : 'rgb(0 0 0 / 70%)'
      ctx.font = `600 ${size}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(noteName(n.p).replace('♯', '#'), x + w / 2, yBottom - size * 0.5, w - 2)
    }
  }

  drawMarks(ctx, l, marks, now, horizon, pxPerSec)

  // Touches blanches puis noires par-dessus
  const keyH = l.height - l.keyboardTop
  for (const black of [false, true]) {
    for (let p = l.first; p <= l.last; p++) {
      if (isBlack(p) !== black) continue
      const [x, w] = keyX(l, p)
      const hand = active.get(p)
      const lit = hand && !hidden.has(hand)
      ctx.fillStyle = lit ? COLORS[hand].white : black ? '#111' : '#f4f4f4'
      ctx.fillRect(x + (black ? 0 : 0.5), l.keyboardTop, w - (black ? 0 : 1), black ? keyH * 0.62 : keyH)
      if (!black && p % 12 === 0 && !lit) {
        ctx.fillStyle = '#999'
        ctx.font = `${Math.max(9, l.whiteWidth * 0.35)}px sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(`C${Math.floor(p / 12) - 1}`, x + w / 2, l.height - 6)
      }
    }
  }
  return active
}

/** Repères (accords, sections) : ligne en travers du rouleau, et le repère en cours épinglé en haut. */
function drawMarks(ctx: CanvasRenderingContext2D, l: Layout, marks: Mark[], now: number, horizon: number, pxPerSec: number) {
  if (!marks.length) return
  const dpr = window.devicePixelRatio || 1
  const width = ctx.canvas.width
  const size = 13 * dpr
  ctx.font = `600 ${size}px system-ui, sans-serif`
  ctx.textAlign = 'left'
  let current: Mark | undefined
  for (const m of marks) {
    if (m.t <= now) current = m
    if (m.t <= now || m.t > horizon) continue
    const y = l.keyboardTop - (m.t - now) * pxPerSec
    ctx.strokeStyle = 'rgb(242 196 109 / 35%)'
    ctx.setLineDash([6 * dpr, 6 * dpr])
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
    ctx.setLineDash([])
    pill(ctx, m.label, 8 * dpr, y - size - 8 * dpr, size, 'rgb(23 25 31 / 85%)', '#f2c46d')
  }
  if (current) {
    ctx.font = `700 ${size * 1.3}px system-ui, sans-serif`
    pill(ctx, current.label, 8 * dpr, 8 * dpr, size * 1.3, '#f2c46d', '#1b1405')
  }
}

function pill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, bg: string, fg: string) {
  const pad = size * 0.5
  const w = ctx.measureText(text).width + pad * 2
  const h = size + pad
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, h / 2)
  ctx.fill()
  ctx.fillStyle = fg
  ctx.fillText(text, x + pad, y + size * 0.95)
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, Math.min(r, h / 2, w / 2))
  ctx.fill()
}

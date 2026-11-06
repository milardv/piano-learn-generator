import type { Hand, Note } from './types'

const BLACK = new Set([1, 3, 6, 8, 10])
export const isBlack = (p: number) => BLACK.has(p % 12)

const COLORS: Record<Hand, { white: string; black: string }> = {
  R: { white: '#4fb3ff', black: '#1f7fcc' },
  L: { white: '#ffa04f', black: '#cc6f1f' },
}

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
  }

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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, Math.min(r, h / 2, w / 2))
  ctx.fill()
}

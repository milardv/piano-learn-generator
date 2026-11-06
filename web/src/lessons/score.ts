import type { Hand, Mark, Note, Song } from '../types'

const STEPS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** « C4 », « Eb3 », « F#2 » → numéro MIDI (C4 = Do central = 60). */
export function pitch(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name)
  if (!m) throw new Error(`Note inconnue : ${name}`)
  return 12 * (Number(m[3]) + 1) + STEPS[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)
}

export const chord = (...names: string[]) => names.map(pitch)

interface PlayOptions {
  v?: number
  f?: number
}

/**
 * Partition écrite en temps (noires) puis convertie en secondes.
 * En mode swing, les croches sur le « et » sont retardées (2/3 – 1/3), comme en blues et en jazz.
 */
export class Score {
  private notes: Note[] = []
  private marks: Mark[] = []
  private end = 0
  private bpm: number
  private swing: boolean

  constructor(bpm: number, swing = false) {
    this.bpm = bpm
    this.swing = swing
  }

  sec(beat: number) {
    const whole = Math.floor(beat)
    const frac = beat - whole
    return ((whole + (this.swing && Math.abs(frac - 0.5) < 1e-6 ? 2 / 3 : frac)) * 60) / this.bpm
  }

  play(hand: Hand, pitches: number | string | (number | string)[], at: number, len: number, o: PlayOptions = {}) {
    const list = Array.isArray(pitches) ? pitches : [pitches]
    const t = this.sec(at)
    const d = (this.sec(at + len) - t) * 0.92
    for (const p of list) {
      this.notes.push({ p: typeof p === 'string' ? pitch(p) : p, t, d, v: o.v ?? 80, h: hand, ...(o.f ? { f: o.f } : {}) })
    }
    this.end = Math.max(this.end, at + len)
    return at + len
  }

  /** Notes successives de même durée ; renvoie le temps suivant. */
  line(hand: Hand, at: number, len: number, names: (string | number | string[] | null)[], fingers?: number[], v?: number) {
    names.forEach((n, i) => {
      if (n !== null) this.play(hand, n, at + i * len, len, { f: fingers?.[i], v })
    })
    this.end = Math.max(this.end, at + names.length * len)
    return at + names.length * len
  }

  /** Notes de durées variées : [note, durée] ; null = silence. */
  rhythm(hand: Hand, at: number, events: [string | string[] | null, number][], v?: number) {
    for (const [n, len] of events) {
      if (n !== null) this.play(hand, n, at, len, { v })
      at += len
    }
    this.end = Math.max(this.end, at)
    return at
  }

  mark(at: number, label: string) {
    this.marks.push({ t: this.sec(at), label })
  }

  toSong(id: string, title: string, program: string, lesson: string): Song {
    const notes = [...this.notes].sort((a, b) => a.t - b.t || a.p - b.p)
    const pitches = notes.map((n) => n.p)
    return {
      version: 2,
      id,
      title,
      mode: 'piano',
      source: { type: 'lesson', program, lesson },
      duration: this.sec(this.end) + 0.5,
      range: { min: Math.min(...pitches), max: Math.max(...pitches) },
      notes,
      pedals: [],
      marks: this.marks.sort((a, b) => a.t - b.t),
    }
  }
}

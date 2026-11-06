/** Format produit par worker/src/piano_worker/notes.py */
export type Hand = 'L' | 'R'
export type Mode = 'song' | 'piano'

export interface Note {
  p: number // hauteur MIDI
  t: number // début (s)
  d: number // durée (s)
  v: number // vélocité 0-127
  h: Hand
  f?: number // doigté conseillé (1 = pouce), exercices guidés
}

/** Repère affiché sur le rouleau : accord, section… */
export interface Mark {
  t: number
  label: string
}

type Source =
  | { type: 'youtube'; url: string; videoId: string; query?: string }
  | { type: 'upload'; file: string }
  | { type: 'soundcloud'; url: string; query?: string }
  | { type: 'lesson'; program: string; lesson: string }

export interface Song {
  version: number
  id: string
  title: string
  mode?: Mode
  cover?: string | null
  source: Source
  duration: number
  range: { min: number; max: number }
  beats?: number[]
  notes: Note[]
  easy?: Note[] // version 2+
  pedals: { t: number; d: number }[]
  marks?: Mark[]
}

export interface SongEntry {
  id: string
  title: string
  mode?: Mode | null
  cover?: string | null
  source: Source
  duration: number
  notes: number
  easy?: number
}

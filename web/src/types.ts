/** Format produit par worker/src/piano_worker/notes.py */
export type Hand = 'L' | 'R'

export interface Note {
  p: number // hauteur MIDI
  t: number // début (s)
  d: number // durée (s)
  v: number // vélocité 0-127
  h: Hand
}

export interface Song {
  version: number
  id: string
  title: string
  source: { type: 'youtube'; url: string; videoId: string } | { type: 'upload'; file: string }
  duration: number
  range: { min: number; max: number }
  notes: Note[]
  pedals: { t: number; d: number }[]
}

export type SongEntry = Pick<Song, 'id' | 'title' | 'source' | 'duration'> & { notes: number }

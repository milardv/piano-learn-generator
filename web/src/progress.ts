// Progression stockée sur l'appareil : temps d'entraînement par jour, paliers et réglages par morceau

const KEY = 'piano-coach:progress'
export const DAILY_GOAL = 10 * 60 // s

export type Level = 'easy' | 'full'
export type HandMode = 'both' | 'R' | 'L'

export interface SongSettings {
  speed: number
  level: Level
  handMode: HandMode
}

export interface SongProgress {
  seconds: number
  lastPlayed: number
  position: number
  stars: number
  settings?: SongSettings
}

interface Progress {
  days: Record<string, number>
  songs: Record<string, SongProgress>
}

/** Paliers d'un morceau, du plus simple au plus exigeant ; chacun demande de jouer le morceau en entier. */
export const MILESTONES = [
  { stars: 1, name: 'Découverte', rule: 'En entier, vitesse ×0,5 ou plus' },
  { stars: 2, name: 'En rythme', rule: 'En entier, Facile à ×1 ou Complet à ×0,75' },
  { stars: 3, name: 'Maîtrise', rule: 'En entier, Complet à ×1' },
]

export function starsFor(level: Level, speed: number) {
  if (level === 'full' && speed >= 1) return 3
  if ((level === 'easy' && speed >= 1) || (level === 'full' && speed >= 0.75)) return 2
  return speed >= 0.5 ? 1 : 0
}

export function load(): Progress {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? '')
    return { days: p.days ?? {}, songs: p.songs ?? {} }
  } catch {
    return { days: {}, songs: {} }
  }
}

function update(fn: (p: Progress) => void) {
  const p = load()
  fn(p)
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* stockage indisponible : la progression ne sera pas conservée */
  }
}

const song = (p: Progress, id: string) =>
  (p.songs[id] ??= { seconds: 0, lastPlayed: 0, position: 0, stars: 0 })

export function addPractice(id: string, seconds: number) {
  if (seconds <= 0) return
  update((p) => {
    const day = today()
    p.days[day] = (p.days[day] ?? 0) + seconds
    const s = song(p, id)
    s.seconds += seconds
    s.lastPlayed = Date.now()
  })
}

export function saveSong(id: string, patch: Partial<Pick<SongProgress, 'position' | 'settings'>>) {
  update((p) => Object.assign(song(p, id), patch))
}

/** Enregistre une écoute complète ; renvoie le nouveau palier s'il dépasse l'ancien. */
export function completePlaythrough(id: string, level: Level, speed: number): number | undefined {
  const earned = starsFor(level, speed)
  let unlocked: number | undefined
  update((p) => {
    const s = song(p, id)
    if (earned > s.stars) {
      s.stars = earned
      unlocked = earned
    }
    s.position = 0
  })
  return unlocked
}

export function todaySeconds(p = load()) {
  return p.days[today()] ?? 0
}

/** Jours consécutifs avec au moins une minute d'entraînement ; aujourd'hui ne casse pas la série tant qu'il n'est pas fini. */
export function streak(p = load()) {
  const practiced = (d: Date) => (p.days[dayKey(d)] ?? 0) >= 60
  const d = new Date()
  if (!practiced(d)) d.setDate(d.getDate() - 1)
  let n = 0
  while (practiced(d)) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

const today = () => dayKey(new Date())
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`

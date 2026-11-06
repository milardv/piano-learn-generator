import type { Song, SongEntry } from './types'

// Dépôt public : la bibliothèque se lit sans jeton, seul le lancement d'une génération en demande un
export const REPO = 'milardv/piano-learn-generator'
const RAW = `https://raw.githubusercontent.com/${REPO}/main/songs`
const API = `https://api.github.com/repos/${REPO}`
const WORKFLOW = 'transcribe.yml'
const TOKEN_KEY = 'piano-coach:github-token'

export const getToken = () => safe(() => localStorage.getItem(TOKEN_KEY)) ?? ''
export const setToken = (token: string) => safe(() => localStorage.setItem(TOKEN_KEY, token.trim()))

/** Union du dépôt (le plus frais) et de la copie locale (hors ligne, ou générée en dev). */
export async function fetchIndex(): Promise<SongEntry[]> {
  const lists = await Promise.allSettled(
    ordered([`${RAW}/index.json?t=${Date.now()}`, 'songs/index.json']).map((url) => fetchFirst<SongEntry[]>([url])),
  )
  const loaded = lists.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
  if (!loaded.length) throw (lists[0] as PromiseRejectedResult).reason
  // À id égal, la première liste l'emporte
  const byId = new Map<string, SongEntry>()
  for (const entry of loaded.flat()) if (!byId.has(entry.id)) byId.set(entry.id, entry)
  return [...byId.values()]
}

export async function fetchSong(id: string): Promise<Song> {
  const file = `${encodeURIComponent(id)}.json`
  return fetchFirst(ordered([`${RAW}/${file}`, `songs/${file}`]))
}

/** En dev, les morceaux générés localement passent avant ceux du dépôt. */
const ordered = (urls: string[]) => (import.meta.env.DEV ? [...urls].reverse() : urls)

export interface GenerateRequest {
  query: string
  title: string
  cover?: string
  mode: 'song' | 'piano'
}

export interface Job extends GenerateRequest {
  requestId: string
  songId: string
  startedAt: number
  status: 'queued' | 'in_progress' | 'done' | 'failed'
  runUrl?: string
  progress?: number // 0-100, estimation
  stage?: string
}

export async function generate(request: GenerateRequest): Promise<Job> {
  const requestId = Math.random().toString(36).slice(2, 10)
  const songId = slugify(request.title)
  const inputs: Record<string, string> = {
    query: request.query,
    title: request.title,
    mode: request.mode,
    id: songId,
    request_id: requestId,
  }
  if (request.cover) inputs.cover = request.cover
  const r = await fetch(`${API}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ ref: 'main', inputs }),
  })
  if (r.status === 401 || r.status === 403) throw new Error('Jeton GitHub refusé')
  if (!r.ok) throw new Error(`GitHub : ${r.status}`)
  return { ...request, requestId, songId, startedAt: Date.now(), status: 'queued' }
}

/** Retrouve le run d'un job par son request_id (présent dans le nom du run). */
export async function refreshJob(job: Job): Promise<Job> {
  const r = await fetch(`${API}/actions/workflows/${WORKFLOW}/runs?event=workflow_dispatch&per_page=30`, { headers: headers() })
  if (!r.ok) return job
  const { workflow_runs: runs } = (await r.json()) as {
    workflow_runs: { id: number; display_title: string; status: string; conclusion: string | null; html_url: string }[]
  }
  const run = runs.find((run) => run.display_title.startsWith(job.requestId))
  if (!run) return job
  const status: Job['status'] =
    run.status !== 'completed' ? (run.status === 'in_progress' ? 'in_progress' : 'queued')
    : run.conclusion === 'success' ? 'done' : 'failed'
  const next: Job = { ...job, status, runUrl: run.html_url }
  if (status !== 'in_progress') return { ...next, progress: status === 'done' ? 100 : next.progress, stage: undefined }
  const j = await fetch(`${API}/actions/runs/${run.id}/jobs`, { headers: headers() })
  if (!j.ok) return next
  const { jobs } = (await j.json()) as { jobs: RunJob[] }
  return { ...next, ...estimate(jobs, job.mode) }
}

interface RunJob {
  name: string
  status: string
  started_at: string | null
  steps?: { name: string; status: string; started_at: string | null }[]
}

/**
 * Avancement estimé d'après les étapes du workflow et leurs durées habituelles (en secondes),
 * mesurées sur les runners GitHub.
 */
function estimate(jobs: RunJob[], mode: GenerateRequest['mode']): Pick<Job, 'progress' | 'stage'> {
  const phases = [
    { stage: 'Préparation de la machine', seconds: 20 },
    { stage: mode === 'song' ? 'Téléchargement et arrangement piano' : 'Téléchargement et transcription', seconds: mode === 'song' ? 70 : 170 },
    { stage: 'Publication du morceau', seconds: 5 },
    { stage: 'Mise en ligne', seconds: 40 },
  ]
  const transcribe = jobs.find((j) => j.name === 'transcribe')
  const deploying = jobs.some((j) => j.name.startsWith('deploy') && j.status !== 'queued')
  const steps = transcribe?.steps ?? []
  const current = steps.find((s) => s.status === 'in_progress')
  let index = 0
  let startedAt = transcribe?.started_at
  if (deploying) {
    index = 3
    startedAt = jobs.find((j) => j.name.startsWith('deploy') && j.started_at)?.started_at ?? null
  } else if (!transcribe || transcribe.status === 'queued') {
    return { progress: 0, stage: 'Machine en cours d’attribution' }
  } else if (current?.name === 'Transcrire') {
    index = 1
    startedAt = current.started_at
  } else if (current?.name === 'Publier le morceau' || (!current && steps.some((s) => s.name === 'Transcrire' && s.status === 'completed'))) {
    index = 2
    startedAt = current?.started_at ?? null
  }
  const total = phases.reduce((sum, p) => sum + p.seconds, 0)
  const before = phases.slice(0, index).reduce((sum, p) => sum + p.seconds, 0)
  const elapsed = startedAt ? (Date.now() - Date.parse(startedAt)) / 1000 : 0
  // Une phase plus longue que prévu reste bloquée à 90 % d'elle-même plutôt que de déborder
  const within = Math.min(elapsed / phases[index].seconds, 0.9) * phases[index].seconds
  return { progress: Math.min(99, Math.round(((before + within) / total) * 100)), stage: phases[index].stage }
}

export function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'morceau'
}

function headers(): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${getToken()}`,
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

async function fetchFirst<T>(urls: string[]): Promise<T> {
  let last: unknown
  for (const url of urls) {
    try {
      const r = await fetch(url, { cache: 'no-cache' })
      if (r.ok) return (await r.json()) as T
      last = new Error(`${url} : ${r.status}`)
    } catch (e) {
      last = e
    }
  }
  throw last
}

function safe<T>(fn: () => T): T | undefined {
  try {
    return fn()
  } catch {
    return undefined
  }
}

import type { Song, SongEntry } from './types'

// Dépôt public : la bibliothèque se lit sans jeton, seul le lancement d'une génération en demande un
export const REPO = 'milardv/piano-learn-generator'
const RAW = `https://raw.githubusercontent.com/${REPO}/main/songs`
const API = `https://api.github.com/repos/${REPO}`
const WORKFLOW = 'transcribe.yml'
const TOKEN_KEY = 'piano-coach:github-token'

export const getToken = () => safe(() => localStorage.getItem(TOKEN_KEY)) ?? ''
export const setToken = (token: string) => safe(() => localStorage.setItem(TOKEN_KEY, token.trim()))

/** Version la plus fraîche (dépôt), sinon celle déployée avec le site (hors ligne). */
export async function fetchIndex(): Promise<SongEntry[]> {
  return fetchFirst(ordered([`${RAW}/index.json?t=${Date.now()}`, 'songs/index.json']))
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
    workflow_runs: { display_title: string; status: string; conclusion: string | null; html_url: string }[]
  }
  const run = runs.find((run) => run.display_title.startsWith(job.requestId))
  if (!run) return job
  const status: Job['status'] =
    run.status !== 'completed' ? (run.status === 'in_progress' ? 'in_progress' : 'queued')
    : run.conclusion === 'success' ? 'done' : 'failed'
  return { ...job, status, runUrl: run.html_url }
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

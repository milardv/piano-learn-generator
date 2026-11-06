import { useCallback, useEffect, useState } from 'react'
import { AddSheet } from './AddSheet'
import { fetchIndex, fetchSong, refreshJob, type Job } from './github'
import { Player } from './Player'
import type { Song, SongEntry } from './types'

const JOBS_KEY = 'piano-coach:jobs'
const POLL_MS = 15000

export default function App() {
  const [songs, setSongs] = useState<SongEntry[]>()
  const [song, setSong] = useState<Song>()
  const [jobs, setJobs] = useState<Job[]>(loadJobs)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string>()

  const reload = useCallback(() => {
    fetchIndex()
      .then(setSongs)
      .catch((e: Error) => setError(e.message))
  }, [])

  useEffect(reload, [reload])

  useEffect(() => saveJobs(jobs), [jobs])

  // Suivi des générations en cours ; un morceau terminé apparaît dans la bibliothèque
  useEffect(() => {
    if (!jobs.some((j) => j.status === 'queued' || j.status === 'in_progress')) return
    const timer = setInterval(async () => {
      const next = await Promise.all(jobs.map((j) => (j.status === 'done' || j.status === 'failed' ? j : refreshJob(j))))
      if (next.some((j, i) => j.status === 'done' && jobs[i].status !== 'done')) reload()
      setJobs(next)
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [jobs, reload])

  const open = async (id: string) => {
    try {
      setSong(await fetchSong(id))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (song) return <Player song={song} onBack={() => setSong(undefined)} />

  const known = new Set(songs?.map((s) => s.id))
  const pending = jobs.filter((j) => !(j.status === 'done' && known.has(j.songId)))

  return (
    <main className="library">
      <header>
        <h1>
          <img className="logo" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
          Piano<span>Coach</span>
        </h1>
        <button className="add" onClick={() => setAdding(true)} aria-label="Ajouter un morceau">
          +
        </button>
      </header>

      {error && <p className="error">{error}</p>}

      {pending.length > 0 && (
        <section>
          <h2>En préparation</h2>
          <ul className="grid">
            {pending.map((j) => (
              <li key={j.requestId} className={`card job ${j.status}`}>
                <Cover src={j.cover} title={j.title} />
                <div className="card-text">
                  <strong>{j.title}</strong>
                  <small>
                    {j.status === 'failed' ? (
                      <>
                        Échec · <a href={j.runUrl} target="_blank" rel="noreferrer">voir</a> ·{' '}
                        <button className="link" onClick={() => setJobs(jobs.filter((x) => x !== j))}>retirer</button>
                      </>
                    ) : (
                      STATUS[j.status]
                    )}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        {!songs && !error && <p className="muted">Chargement…</p>}
        {songs?.length === 0 && <p className="muted">Aucun morceau. Appuie sur + pour commencer.</p>}
        <ul className="grid">
          {songs?.map((s) => (
            <li key={s.id}>
              <button className="card" onClick={() => open(s.id)}>
                <Cover src={s.cover} title={s.title} />
                <div className="card-text">
                  <strong>{s.title}</strong>
                  <small>
                    {Math.round(s.duration / 60)} min · {s.mode === 'song' ? 'arrangement' : 'piano solo'}
                  </small>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {adding && (
        <AddSheet
          onClose={() => setAdding(false)}
          onQueued={(job) => {
            setJobs([job, ...jobs])
            setAdding(false)
          }}
        />
      )}
    </main>
  )
}

const STATUS: Record<Job['status'], string> = {
  queued: 'En file d’attente…',
  in_progress: 'Génération en cours…',
  done: 'Publication…',
  failed: 'Échec',
}

/** Pochette, ou à défaut un dégradé propre à chaque titre. */
function Cover({ src, title }: { src?: string | null; title: string }) {
  if (src) return <img className="cover" src={src} alt="" loading="lazy" />
  let hash = 0
  for (const c of title) hash = (hash * 31 + c.charCodeAt(0)) | 0
  const hue = Math.abs(hash) % 360
  return (
    <div
      className="cover"
      style={{ background: `linear-gradient(135deg, hsl(${hue} 55% 38%), hsl(${(hue + 50) % 360} 60% 22%))` }}
    >
      {title.slice(0, 1)}
    </div>
  )
}

function loadJobs(): Job[] {
  try {
    return JSON.parse(localStorage.getItem(JOBS_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveJobs(jobs: Job[]) {
  try {
    // On oublie les jobs de plus de 2 jours
    localStorage.setItem(JOBS_KEY, JSON.stringify(jobs.filter((j) => Date.now() - j.startedAt < 2 * 86400e3)))
  } catch {
    /* stockage indisponible (navigation privée) : le suivi ne survivra pas au rechargement */
  }
}

import { useCallback, useEffect, useState } from 'react'
import { AddSheet } from './AddSheet'
import { fetchIndex, fetchSong, refreshJob, type Job } from './github'
import { lessonSong, PROGRAMS } from './lessons/programs'
import { Player } from './Player'
import { LessonView, ProgramList, ProgramView } from './Programs'
import { DAILY_GOAL, load as loadProgress, streak, todaySeconds } from './progress'
import type { Song, SongEntry } from './types'

const JOBS_KEY = 'piano-coach:jobs'
const POLL_MS = 5000

export default function App() {
  const [songs, setSongs] = useState<SongEntry[]>()
  const [song, setSong] = useState<Song>()
  const [jobs, setJobs] = useState<Job[]>(loadJobs)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string>()
  const [filter, setFilter] = useState('')
  const [tab, setTab] = useState<'songs' | 'programs'>('songs')
  const [programId, setProgramId] = useState<string>()
  const [lessonId, setLessonId] = useState<string>()

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

  const program = PROGRAMS.find((p) => p.id === programId)
  const lessonIndex = program?.lessons.findIndex((l) => l.id === lessonId) ?? -1
  if (program && lessonIndex >= 0) {
    const lesson = program.lessons[lessonIndex]
    const next = program.lessons[lessonIndex + 1]
    return (
      <main className="library">
        <LessonView
          program={program}
          lesson={lesson}
          onBack={() => setLessonId(undefined)}
          onStart={() => setSong(lessonSong(program, lesson))}
          onNext={next ? () => setLessonId(next.id) : undefined}
        />
      </main>
    )
  }
  if (program) {
    return (
      <main className="library">
        <ProgramView program={program} onBack={() => setProgramId(undefined)} onLesson={(l) => setLessonId(l.id)} />
      </main>
    )
  }

  const known = new Set(songs?.map((s) => s.id))
  const pending = jobs.filter((j) => !(j.status === 'done' && known.has(j.songId)))
  const progress = loadProgress()
  const played = (id: string) => progress.songs[id]?.lastPlayed ?? 0
  // Derniers morceaux travaillés d'abord, puis le reste dans l'ordre de la bibliothèque
  const sorted = [...(songs ?? [])].sort((a, b) => played(b.id) - played(a.id))
  const query = normalize(filter)
  const visible = sorted.filter((s) => normalize(s.title).includes(query))
  const resume = sorted.find((s) => played(s.id) && (progress.songs[s.id].position ?? 0) > 10)

  return (
    <main className="library">
      <header>
        <h1>
          <img className="logo" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
          Piano<span>Coach</span>
        </h1>
        {tab === 'songs' && (
          <button className="add" onClick={() => setAdding(true)} aria-label="Ajouter un morceau">
            +
          </button>
        )}
      </header>

      <Stats today={todaySeconds(progress)} streak={streak(progress)} />

      <div className="segmented tabs" role="tablist">
        <button role="tab" aria-checked={tab === 'songs'} aria-selected={tab === 'songs'} onClick={() => setTab('songs')}>
          Morceaux
        </button>
        <button role="tab" aria-checked={tab === 'programs'} aria-selected={tab === 'programs'} onClick={() => setTab('programs')}>
          Programmes
        </button>
      </div>

      {tab === 'programs' && <ProgramList programs={PROGRAMS} onOpen={(p) => setProgramId(p.id)} />}

      {tab === 'songs' && (
        <>
      {error && <p className="error">{error}</p>}

      {resume && !filter && (
        <button className="resume" onClick={() => open(resume.id)}>
          <Cover src={resume.cover} title={resume.title} />
          <span>
            <small>Reprendre</small>
            <strong>{resume.title}</strong>
            <small>
              à {format(progress.songs[resume.id].position)}
              {progress.songs[resume.id].stars > 0 && ' · '}
              <Stars n={progress.songs[resume.id].stars} />
            </small>
          </span>
          <span className="resume-play" aria-hidden>
            ▶
          </span>
        </button>
      )}

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
                    ) : j.status === 'in_progress' && j.progress !== undefined ? (
                      <>
                        {j.progress} % · {j.stage}
                      </>
                    ) : (
                      STATUS[j.status]
                    )}
                  </small>
                  {j.status !== 'failed' && (
                    <div className="job-progress" role="progressbar" aria-valuenow={j.progress ?? 0}>
                      <i style={{ width: `${j.status === 'done' ? 100 : (j.progress ?? 0)}%` }} />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        {(songs?.length ?? 0) > 6 && (
          <input
            className="filter"
            type="search"
            placeholder="Filtrer la bibliothèque"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        )}
        {!songs && !error && <p className="muted">Chargement…</p>}
        {songs?.length === 0 && <p className="muted">Aucun morceau. Appuie sur + pour commencer.</p>}
        <ul className="grid">
          {visible.map((s) => (
            <li key={s.id}>
              <button className="card" onClick={() => open(s.id)}>
                <Cover src={s.cover} title={s.title} />
                <div className="card-text">
                  <strong>{s.title}</strong>
                  <small>
                    {Math.round(s.duration / 60)} min · {s.mode === 'song' ? 'arrangement' : 'piano solo'}
                  </small>
                  <Stars n={progress.songs[s.id]?.stars ?? 0} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>

        </>
      )}

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

/** Objectif du jour (anneau) et série de jours consécutifs. */
function Stats({ today, streak }: { today: number; streak: number }) {
  const ratio = Math.min(1, today / DAILY_GOAL)
  const r = 15
  const c = 2 * Math.PI * r
  return (
    <div className="stats">
      <div className={`stat ${ratio >= 1 ? 'done' : ''}`}>
        <svg viewBox="0 0 36 36" aria-hidden>
          <circle cx="18" cy="18" r={r} className="track" />
          <circle cx="18" cy="18" r={r} className="fill" strokeDasharray={c} strokeDashoffset={c * (1 - ratio)} />
        </svg>
        <span>
          <strong>
            {Math.floor(today / 60)} / {DAILY_GOAL / 60} min
          </strong>
          <small>{ratio >= 1 ? 'Objectif du jour atteint' : 'Objectif du jour'}</small>
        </span>
      </div>
      <div className={`stat ${streak ? 'done' : ''}`}>
        <span className="flame" aria-hidden>
          🔥
        </span>
        <span>
          <strong>
            {streak} jour{streak > 1 ? 's' : ''}
          </strong>
          <small>{streak ? 'de suite' : 'Joue une minute pour lancer ta série'}</small>
        </span>
      </div>
    </div>
  )
}

function Stars({ n }: { n: number }) {
  if (!n) return null
  return (
    <span className="stars small" aria-label={`${n} sur 3`}>
      {'★'.repeat(n)}
      <span className="muted">{'☆'.repeat(3 - n)}</span>
    </span>
  )
}

const normalize = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

function format(t: number) {
  const s = Math.max(0, Math.floor(t))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
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

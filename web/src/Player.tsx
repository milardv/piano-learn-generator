import { useEffect, useMemo, useRef, useState } from 'react'
import { draw, keyRange, makeLayout } from './keyboard'
import { loadPiano, playNote, stopAll } from './piano'
import { addPractice, completePlaythrough, load, MILESTONES, saveSong, type HandMode, type Level } from './progress'
import type { Hand, Song } from './types'

const PX_PER_SEC = 160
const LEAD_IN = 2 // s de défilement avant la première note
const SPEED_MIN = 0.25
const SPEED_MAX = 1.5
const SPEED_STEP = 0.05
const FULL_PASS = 0.85 // part du morceau à avoir jouée sans boucle pour valider un palier
const PREFS_KEY = 'piano-coach:prefs'

interface Loop {
  a: number
  b?: number
}

interface Prefs {
  labels: boolean
  ramp: boolean
}

export function Player({ song, onBack }: { song: Song; onBack: () => void }) {
  const saved = useMemo(() => load().songs[song.id], [song.id])
  const hasEasy = !!song.easy?.length
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [speed, setSpeed] = useState(saved?.settings?.speed ?? 1)
  const [level, setLevel] = useState<Level>(hasEasy ? (saved?.settings?.level ?? 'easy') : 'full')
  const [handMode, setHandMode] = useState<HandMode>(saved?.settings?.handMode ?? 'both')
  const [sound, setSound] = useState(true)
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)
  const [loop, setLoop] = useState<Loop>()
  const [panel, setPanel] = useState(false)
  const [stars, setStars] = useState(saved?.stars ?? 0)
  const [toast, setToast] = useState<number>()
  // Reprise là où on s'était arrêté, avec un peu d'élan
  const [time, setTime] = useState(() =>
    saved && saved.position > 10 && saved.position < song.duration - 10 ? saved.position - LEAD_IN : -LEAD_IN,
  )
  const notes = useMemo(() => (level === 'easy' && hasEasy ? song.easy! : song.notes), [song, level, hasEasy])

  // État lu par la boucle d'animation sans la relancer
  const live = useRef({
    time,
    next: 0,
    playing,
    speed,
    sound,
    level,
    loop,
    prefs,
    hidden: new Set<Hand>(),
    covered: 0,
    minSpeed: Infinity,
    practice: 0,
  })
  const s0 = live.current
  s0.playing = playing
  s0.speed = speed
  s0.sound = sound
  s0.level = level
  s0.loop = loop
  s0.prefs = prefs
  s0.hidden = new Set<Hand>(handMode === 'both' ? [] : handMode === 'R' ? ['L'] : ['R'])

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const pitches = notes.map((n) => n.p)
    const [first, last] = keyRange(Math.min(...pitches, 60), Math.max(...pitches, 72))
    const s = live.current
    // Changement de niveau : on repart de la position courante, et l'écoute complète recommence
    s.next = firstIndexAt(notes, s.time)
    s.covered = 0
    s.minSpeed = Infinity
    let layout = makeLayout(first, last, 1, 1)

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = canvas.clientWidth * dpr
      canvas.height = canvas.clientHeight * dpr
      layout = makeLayout(first, last, canvas.width, canvas.height)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    const finish = () => {
      s.playing = false
      setPlaying(false)
      if (s.covered >= FULL_PASS * song.duration) {
        const unlocked = completePlaythrough(song.id, s.level, s.minSpeed)
        if (unlocked) {
          setStars(unlocked)
          setToast(unlocked)
        }
      }
      s.covered = 0
      s.minSpeed = Infinity
    }

    let frame = 0
    let previous = performance.now()
    let lastUiUpdate = 0
    const loop = (ts: number) => {
      const dt = Math.min((ts - previous) / 1000, 0.25) // onglet en arrière-plan : pas de saut
      previous = ts
      if (s.playing) {
        s.time += dt * s.speed
        s.practice += dt
        if (s.loop?.b !== undefined && s.time >= s.loop.b) {
          s.time = s.loop.a - 1
          s.next = firstIndexAt(notes, s.time)
          stopAll()
          if (s.prefs.ramp) setSpeed((v) => Math.min(1, Math.max(v, round(v + SPEED_STEP))))
        } else if (!s.loop) {
          s.covered += dt * s.speed
          s.minSpeed = Math.min(s.minSpeed, s.speed)
        }
        while (s.next < notes.length && notes[s.next].t <= s.time) {
          const n = notes[s.next++]
          if (s.sound && !s.hidden.has(n.h)) playNote(n.p, n.d / s.speed, n.v)
        }
        if (s.time > song.duration + 1) finish()
      }
      draw(ctx, layout, notes, s.time, PX_PER_SEC * (window.devicePixelRatio || 1), s.hidden, s.prefs.labels, song.marks)
      if (ts - lastUiUpdate > 250) {
        lastUiUpdate = ts
        setTime(s.time)
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      stopAll()
    }
  }, [song, notes])

  // Temps d'entraînement et position, enregistrés régulièrement et en quittant
  useEffect(() => {
    const flush = () => {
      addPractice(song.id, live.current.practice)
      live.current.practice = 0
      saveSong(song.id, { position: Math.max(0, live.current.time) })
    }
    const timer = setInterval(flush, 10000)
    return () => {
      clearInterval(timer)
      flush()
    }
  }, [song.id])

  useEffect(() => saveSong(song.id, { settings: { speed, level, handMode } }), [song.id, speed, level, handMode])

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
    } catch {
      /* réglages non conservés */
    }
  }, [prefs])

  // L'écran reste allumé pendant la lecture
  useEffect(() => {
    if (!playing || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | undefined
    let released = false
    navigator.wakeLock
      .request('screen')
      .then((l) => {
        if (released) l.release()
        else lock = l
      })
      .catch(() => {})
    return () => {
      released = true
      lock?.release()
    }
  }, [playing])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(undefined), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  const seek = (t: number) => {
    const s = live.current
    t = clamp(t, -LEAD_IN, song.duration)
    stopAll()
    // Retour au début : nouvelle écoute complète
    if (t <= 0.5) {
      s.covered = 0
      s.minSpeed = Infinity
    }
    s.time = t
    s.next = firstIndexAt(notes, t)
    setTime(t)
  }

  const togglePlay = async () => {
    if (playing) {
      stopAll()
      setPlaying(false)
      return
    }
    setLoading(true)
    await loadPiano()
    setLoading(false)
    if (live.current.time > song.duration) seek(-LEAD_IN)
    setPlaying(true)
  }

  const changeSpeed = (delta: number) => setSpeed((v) => clamp(round(v + delta), SPEED_MIN, SPEED_MAX))

  const loopTap = () => {
    const t = clamp(live.current.time, 0, song.duration)
    if (!loop) setLoop({ a: t })
    else if (loop.b === undefined && t > loop.a + 0.5) setLoop({ a: loop.a, b: t })
    else setLoop(undefined)
  }

  // Raccourcis clavier (ordinateur, clavier Bluetooth)
  const actions = useRef({ togglePlay, seek, changeSpeed, loopTap, onBack })
  actions.current = { togglePlay, seek, changeSpeed, loopTap, onBack }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, select, button')) return
      const a = actions.current
      const handlers: Record<string, () => void> = {
        ' ': a.togglePlay,
        ArrowLeft: () => a.seek(live.current.time - 5),
        ArrowRight: () => a.seek(live.current.time + 5),
        ArrowUp: () => a.changeSpeed(SPEED_STEP),
        ArrowDown: () => a.changeSpeed(-SPEED_STEP),
        l: a.loopTap,
        n: () => setPrefs((p) => ({ ...p, labels: !p.labels })),
        Escape: a.onBack,
      }
      const handler = handlers[e.key]
      if (!handler) return
      e.preventDefault()
      handler()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Sur le rouleau : un appui lance ou met en pause, un glissé vertical fait défiler le morceau
  const drag = useRef<{ y: number; t: number; moved: boolean }>(undefined)
  const pointer = {
    onPointerDown: (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      drag.current = { y: e.clientY, t: live.current.time, moved: false }
    },
    onPointerMove: (e: React.PointerEvent) => {
      const d = drag.current
      if (!d) return
      const dy = e.clientY - d.y
      if (Math.abs(dy) > 6) d.moved = true
      if (d.moved) seek(d.t + dy / PX_PER_SEC)
    },
    onPointerUp: () => {
      if (drag.current && !drag.current.moved) togglePlay()
      drag.current = undefined
    },
    onPointerCancel: () => (drag.current = undefined),
  }

  const pct = (t: number) => `${(clamp(t, 0, song.duration) / song.duration) * 100}%`

  return (
    <div className="player">
      <canvas ref={canvasRef} className="roll" {...pointer} />

      {toast && (
        <div className="toast" role="status">
          <span className="stars">{'★'.repeat(toast)}</span>
          Palier « {MILESTONES[toast - 1].name} » débloqué
        </div>
      )}

      {panel && (
        <div className="panel" role="dialog" aria-label="Réglages">
          {hasEasy && (
            <Segmented
              label="Difficulté"
              value={level}
              onChange={setLevel}
              options={[
                ['easy', 'Facile'],
                ['full', 'Complet'],
              ]}
            />
          )}
          <Segmented
            label="Mains"
            value={handMode}
            onChange={setHandMode}
            options={[
              ['both', '2 mains'],
              ['R', 'Droite'],
              ['L', 'Gauche'],
            ]}
          />
          <Switch checked={sound} onChange={setSound} label="Son" />
          <Switch checked={prefs.labels} onChange={(labels) => setPrefs({ ...prefs, labels })} label="Noms des notes" />
          <Switch
            checked={prefs.ramp}
            onChange={(ramp) => setPrefs({ ...prefs, ramp })}
            label="Accélérer la boucle"
            hint="+5 % à chaque tour, jusqu’à ×1"
          />
          <ol className="milestones">
            {MILESTONES.map((m) => (
              <li key={m.stars} className={stars >= m.stars ? 'done' : ''}>
                <span className="stars">{'★'.repeat(m.stars)}</span>
                <span>
                  <strong>{m.name}</strong>
                  <small>{m.rule}</small>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="controls">
        <button onClick={onBack} aria-label="Retour">←</button>
        <button className="primary" onClick={togglePlay} disabled={loading} aria-label={playing ? 'Pause' : 'Lecture'}>
          {loading ? '…' : playing ? '❚❚' : '▶'}
        </button>
        <button
          className={`loop ${loop ? 'active' : ''}`}
          onClick={loopTap}
          aria-label={!loop ? 'Début de boucle' : loop.b === undefined ? 'Fin de boucle' : 'Retirer la boucle'}
        >
          {!loop ? '⟲ A' : loop.b === undefined ? '⟲ B' : '⟲ ✕'}
        </button>
        <div className="seek">
          {loop && (
            <div
              className="loop-band"
              style={{ left: pct(loop.a), width: loop.b === undefined ? 2 : `calc(${pct(loop.b)} - ${pct(loop.a)})` }}
            />
          )}
          <input
            type="range"
            min={-LEAD_IN}
            max={song.duration}
            step={0.1}
            value={time}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Position"
          />
        </div>
        <span className="time">
          {format(time)} / {format(song.duration)}
        </span>
        <div className="stepper" role="group" aria-label="Vitesse">
          <button onClick={() => changeSpeed(-SPEED_STEP)} disabled={speed <= SPEED_MIN} aria-label="Plus lent">−</button>
          <output>×{speed.toFixed(2)}</output>
          <button onClick={() => changeSpeed(SPEED_STEP)} disabled={speed >= SPEED_MAX} aria-label="Plus rapide">+</button>
        </div>
        <button className={panel ? 'active' : ''} onClick={() => setPanel(!panel)} aria-label="Réglages" aria-expanded={panel}>
          <span className="stars small">{'★'.repeat(stars) + '☆'.repeat(3 - stars)}</span>
        </button>
      </div>
    </div>
  )
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: [T, string][]
}) {
  return (
    <div className="segmented compact" role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} role="radio" aria-checked={value === v} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  )
}

function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <button className="switch" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <i aria-hidden />
    </button>
  )
}

function loadPrefs(): Prefs {
  try {
    return { labels: false, ramp: false, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') }
  } catch {
    return { labels: false, ramp: false }
  }
}

function firstIndexAt(notes: Song['notes'], t: number) {
  const i = notes.findIndex((n) => n.t >= t)
  return i < 0 ? notes.length : i
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const round = (v: number) => Math.round(v * 100) / 100

function format(t: number) {
  const s = Math.max(0, Math.floor(t))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

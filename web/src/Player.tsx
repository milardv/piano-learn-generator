import { useEffect, useRef, useState } from 'react'
import { draw, keyRange, makeLayout } from './keyboard'
import { loadPiano, playNote, stopAll } from './piano'
import type { Hand, Song } from './types'

const PX_PER_SEC = 160
const LEAD_IN = 2 // s de défilement avant la première note

type HandMode = 'both' | 'R' | 'L'

export function Player({ song, onBack }: { song: Song; onBack: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [handMode, setHandMode] = useState<HandMode>('both')
  const [sound, setSound] = useState(true)
  const [time, setTime] = useState(-LEAD_IN)

  // État lu par la boucle d'animation sans la relancer
  const live = useRef({ time: -LEAD_IN, next: 0, playing, speed, sound, hidden: new Set<Hand>() })
  live.current.playing = playing
  live.current.speed = speed
  live.current.sound = sound
  live.current.hidden = new Set<Hand>(handMode === 'both' ? [] : handMode === 'R' ? ['L'] : ['R'])

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const [first, last] = keyRange(song.range.min, song.range.max)
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

    let frame = 0
    let previous = performance.now()
    let lastUiUpdate = 0
    const loop = (ts: number) => {
      const s = live.current
      const dt = (ts - previous) / 1000
      previous = ts
      if (s.playing) {
        s.time += dt * s.speed
        while (s.next < song.notes.length && song.notes[s.next].t <= s.time) {
          const n = song.notes[s.next++]
          if (s.sound && !s.hidden.has(n.h)) playNote(n.p, n.d / s.speed, n.v)
        }
        if (s.time > song.duration + 1) setPlaying(false)
      }
      draw(ctx, layout, song.notes, s.time, PX_PER_SEC * (window.devicePixelRatio || 1), s.hidden)
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
  }, [song])

  const seek = (t: number) => {
    stopAll()
    live.current.time = t
    live.current.next = song.notes.findIndex((n) => n.t >= t)
    if (live.current.next < 0) live.current.next = song.notes.length
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

  return (
    <div className="player">
      <canvas ref={canvasRef} className="roll" />
      <div className="controls">
        <button onClick={onBack} aria-label="Retour">←</button>
        <button className="primary" onClick={togglePlay} disabled={loading}>
          {loading ? '…' : playing ? '❚❚' : '▶'}
        </button>
        <input
          className="seek"
          type="range"
          min={-LEAD_IN}
          max={song.duration}
          step={0.1}
          value={time}
          onChange={(e) => seek(Number(e.target.value))}
        />
        <span className="time">{format(time)} / {format(song.duration)}</span>
        <label>
          ×{speed.toFixed(2)}
          <input type="range" min={0.25} max={1.5} step={0.05} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
        </label>
        <select value={handMode} onChange={(e) => setHandMode(e.target.value as HandMode)}>
          <option value="both">2 mains</option>
          <option value="R">Main droite</option>
          <option value="L">Main gauche</option>
        </select>
        <button onClick={() => setSound(!sound)} aria-label="Son">{sound ? '🔊' : '🔇'}</button>
      </div>
    </div>
  )
}

function format(t: number) {
  const s = Math.max(0, Math.floor(t))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

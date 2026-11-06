import { useEffect, useState } from 'react'
import { Player } from './Player'
import type { Song, SongEntry } from './types'

export default function App() {
  const [songs, setSongs] = useState<SongEntry[]>()
  const [song, setSong] = useState<Song>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    fetch('songs/index.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`index.json : ${r.status}`))))
      .then(setSongs)
      .catch((e: Error) => setError(e.message))
  }, [])

  const open = async (id: string) => {
    const r = await fetch(`songs/${encodeURIComponent(id)}.json`)
    if (r.ok) setSong(await r.json())
    else setError(`${id} : ${r.status}`)
  }

  if (song) return <Player song={song} onBack={() => setSong(undefined)} />

  return (
    <main className="library">
      <h1>Piano Coach</h1>
      {error && <p className="error">{error}</p>}
      {!songs && !error && <p>Chargement…</p>}
      {songs?.length === 0 && <p>Aucun morceau pour l'instant.</p>}
      <ul>
        {songs?.map((s) => (
          <li key={s.id}>
            <button onClick={() => open(s.id)}>
              <strong>{s.title}</strong>
              <span>{Math.round(s.duration / 60)} min · {s.notes} notes · {s.source.type === 'youtube' ? 'YouTube' : 'micro'}</span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}

import { useEffect, useRef, useState } from 'react'
import { generate, getToken, setToken, type Job } from './github'
import { searchTracks, type Suggestion } from './itunes'
import type { Mode } from './types'

const DEBOUNCE_MS = 250

export function AddSheet({ onClose, onQueued }: { onClose: () => void; onQueued: (job: Job) => void }) {
  const [term, setTerm] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState<Suggestion>()
  const [mode, setMode] = useState<Mode>('song')
  const [token, setTokenState] = useState(getToken())
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string>()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => inputRef.current?.focus(), [])

  useEffect(() => {
    const q = term.trim()
    if (q.length < 2 || picked) {
      setSuggestions([])
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        setSuggestions(await searchTracks(q, controller.signal))
      } catch (e) {
        if (!controller.signal.aborted) setError((e as Error).message)
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [term, picked])

  const pick = (s: Suggestion) => {
    setPicked(s)
    setTerm(`${s.artist} - ${s.title}`)
    setSuggestions([])
  }

  const submit = async () => {
    const query = term.trim()
    if (!query) return
    setError(undefined)
    setSending(true)
    try {
      setToken(token)
      const job = await generate({
        query,
        title: picked ? `${picked.artist} - ${picked.title}` : query,
        cover: picked?.cover,
        mode,
      })
      onQueued(job)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Ajouter un morceau" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <h2>Ajouter un morceau</h2>

        <div className="search">
          {picked?.cover && <img className="search-cover" src={picked.cover} alt="" />}
          <input
            ref={inputRef}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder="Artiste ou titre…"
            value={term}
            onChange={(e) => {
              setPicked(undefined)
              setTerm(e.target.value)
            }}
            onKeyDown={(e) => e.key === 'Enter' && suggestions[0] && pick(suggestions[0])}
          />
          {searching && <span className="spinner" aria-label="Recherche" />}
        </div>

        {suggestions.length > 0 && (
          <ul className="suggestions">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button onClick={() => pick(s)}>
                  {s.cover ? <img src={s.cover} alt="" /> : <span className="cover-fallback" />}
                  <span>
                    <strong>{s.title}</strong>
                    <small>{s.artist}{s.album && ` · ${s.album}`}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="segmented" role="radiogroup" aria-label="Type d'audio">
          <button role="radio" aria-checked={mode === 'song'} onClick={() => setMode('song')}>
            Chanson
            <small>pop, rock… → arrangement piano</small>
          </button>
          <button role="radio" aria-checked={mode === 'piano'} onClick={() => setMode('piano')}>
            Piano solo
            <small>transcription fidèle</small>
          </button>
        </div>

        {!getToken() && (
          <label className="token">
            Jeton GitHub (une seule fois, reste sur cet appareil)
            <input
              type="password"
              autoComplete="off"
              autoCapitalize="none"
              placeholder="github_pat_…"
              value={token}
              onChange={(e) => setTokenState(e.target.value)}
            />
          </label>
        )}

        {error && <p className="error">{error}</p>}

        <button className="cta" onClick={submit} disabled={!term.trim() || sending || !token}>
          {sending ? 'Envoi…' : 'Générer la version piano'}
        </button>
        <p className="hint">Environ 5 à 10 minutes. Tu peux fermer l'appli, le morceau t'attendra.</p>
      </div>
    </div>
  )
}

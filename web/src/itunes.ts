/** Autocomplétion artiste / titre : API iTunes Search (gratuite, sans clé, CORS ouvert). */
export interface Suggestion {
  id: number
  artist: string
  title: string
  album: string
  cover: string
}

interface ITunesTrack {
  trackId: number
  artistName: string
  trackName: string
  collectionName?: string
  artworkUrl100?: string
}

export async function searchTracks(term: string, signal: AbortSignal): Promise<Suggestion[]> {
  const url = new URL('https://itunes.apple.com/search')
  url.search = new URLSearchParams({ term, media: 'music', entity: 'song', limit: '8', country: 'FR' }).toString()
  const r = await fetch(url, { signal })
  if (!r.ok) throw new Error(`iTunes : ${r.status}`)
  const { results } = (await r.json()) as { results: ITunesTrack[] }
  // Une seule entrée par couple artiste / titre (singles, albums, compilations…)
  const seen = new Set<string>()
  return results
    .filter((t) => {
      const key = `${t.artistName}|${t.trackName}`.toLowerCase()
      return !seen.has(key) && seen.add(key)
    })
    .map((t) => ({
      id: t.trackId,
      artist: t.artistName,
      title: t.trackName,
      album: t.collectionName ?? '',
      cover: t.artworkUrl100?.replace('100x100bb', '300x300bb') ?? '',
    }))
}

import { Reverb, SplendidGrandPiano } from 'smplr'

// Splendid Grand Piano (Steinway, plusieurs couches de vélocité), avec une légère réverbération de salle
let context: AudioContext | undefined
let piano: ReturnType<typeof SplendidGrandPiano> | undefined

/** À appeler depuis un geste utilisateur (exigence iOS/Chrome pour démarrer l'audio). */
export async function loadPiano() {
  context ??= new AudioContext({ latencyHint: 'interactive' })
  await context.resume()
  if (!piano) {
    piano = SplendidGrandPiano(context, { volume: 100, decayTime: 0.8 })
    piano.output.addEffect('reverb', Reverb(context), 0.18)
  }
  await piano.ready
  return piano
}

export function playNote(pitch: number, duration: number, velocity: number) {
  piano?.start({ note: pitch, velocity, duration })
}

export function stopAll() {
  piano?.stop()
}

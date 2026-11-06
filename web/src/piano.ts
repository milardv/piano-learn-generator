import * as Tone from 'tone'

// Échantillons Salamander Grand Piano (CC-BY), 1 note sur 3 : Tone.Sampler rééchantillonne le reste
const SAMPLES: Record<string, string> = {}
for (const octave of [1, 2, 3, 4, 5, 6, 7]) {
  for (const [name, file] of [['C', 'C'], ['D#', 'Ds'], ['F#', 'Fs'], ['A', 'A']]) {
    SAMPLES[`${name}${octave}`] = `${file}${octave}.mp3`
  }
}

let sampler: Tone.Sampler | undefined

/** À appeler depuis un geste utilisateur (exigence iOS/Chrome pour démarrer l'audio). */
export async function loadPiano(): Promise<Tone.Sampler> {
  await Tone.start()
  if (!sampler) {
    sampler = new Tone.Sampler({
      urls: SAMPLES,
      baseUrl: 'https://tonejs.github.io/audio/salamander/',
      release: 1,
    }).toDestination()
  }
  await Tone.loaded()
  return sampler
}

export function playNote(pitch: number, duration: number, velocity: number) {
  sampler?.triggerAttackRelease(Tone.Frequency(pitch, 'midi').toFrequency(), duration, Tone.now(), velocity / 127)
}

export function stopAll() {
  sampler?.releaseAll()
}

import type { Song } from '../types'
import { Score } from './score'

export interface Lesson {
  id: string
  title: string
  goal: string
  explain: string[]
  tips: string[]
  bpm: number
  swing?: boolean
  hands: 'MD' | 'MG' | '2 mains'
  build: (s: Score) => void
}

export interface Program {
  id: string
  title: string
  style: string
  level: string
  summary: string
  hue: number
  lessons: Lesson[]
}

type V = string | string[]

/** Répète une suite d'accords : une mesure (4 temps) par accord. */
function bars<T>(s: Score, at: number, items: T[], fn: (item: T, at: number, i: number) => void, label?: (item: T) => string) {
  items.forEach((item, i) => {
    if (label) s.mark(at + i * 4, label(item))
    fn(item, at + i * 4, i)
  })
  return at + items.length * 4
}

// ---------- Premiers pas ----------

const C_UP = ['C4', 'D4', 'E4', 'F4', 'G4']
const C_UP_LH = ['C3', 'D3', 'E3', 'F3', 'G3']

const bases: Program = {
  id: 'bases',
  title: 'Premiers pas',
  style: 'Bases',
  level: 'Débutant',
  summary: 'Position de la main, doigtés, gamme de Do et premiers accords, jusqu’à une première mélodie accompagnée.',
  hue: 205,
  lessons: [
    {
      id: 'position-md',
      title: 'Position de Do, main droite',
      goal: 'Placer les 5 doigts sur Do-Ré-Mi-Fa-Sol et les rendre indépendants.',
      explain: [
        'Le pouce (1) se pose sur le Do central, puis un doigt par touche : 2 sur Ré, 3 sur Mi, 4 sur Fa, 5 sur Sol.',
        'Le chiffre affiché sur chaque note est le doigt à utiliser.',
        'Deuxième partie : des sauts de tierce, pour que chaque doigt sache trouver sa touche sans glisser.',
      ],
      tips: [
        'Doigts arrondis, comme si tu tenais une balle.',
        'Joue avec le bout des doigts, poignet souple au niveau des touches.',
        'À ×0,5 d’abord : la régularité compte plus que la vitesse.',
      ],
      bpm: 72,
      hands: 'MD',
      build: (s) => {
        s.mark(0, 'Montée, descente')
        let t = s.line('R', 0, 1, [...C_UP, 'F4', 'E4', 'D4'], [1, 2, 3, 4, 5, 4, 3, 2])
        t = s.line('R', t, 1, [...C_UP, 'F4', 'E4', 'D4'], [1, 2, 3, 4, 5, 4, 3, 2])
        t = s.play('R', 'C4', t, 4, { f: 1 })
        s.mark(t, 'Tierces')
        t = s.line('R', t, 1, ['C4', 'E4', 'D4', 'F4', 'E4', 'G4', 'F4', 'D4'], [1, 3, 2, 4, 3, 5, 4, 2])
        t = s.line('R', t, 1, ['E4', 'C4', 'D4', 'F4', 'E4', 'D4'], [3, 1, 2, 4, 3, 2])
        s.play('R', 'C4', t, 2, { f: 1 })
      },
    },
    {
      id: 'position-mg',
      title: 'Position de Do, main gauche',
      goal: 'Même travail à la main gauche, une octave plus bas.',
      explain: [
        'À la main gauche, les doigts s’inversent : l’auriculaire (5) sur le Do, le pouce (1) sur le Sol.',
        'La main gauche joue souvent les basses : vise un son rond et égal.',
      ],
      tips: ['Garde la même forme de main qu’à droite.', 'Le 4 et le 5 sont les plus faibles : appuie franchement.'],
      bpm: 72,
      hands: 'MG',
      build: (s) => {
        s.mark(0, 'Montée, descente')
        let t = s.line('L', 0, 1, [...C_UP_LH, 'F3', 'E3', 'D3'], [5, 4, 3, 2, 1, 2, 3, 4])
        t = s.line('L', t, 1, [...C_UP_LH, 'F3', 'E3', 'D3'], [5, 4, 3, 2, 1, 2, 3, 4])
        t = s.play('L', 'C3', t, 4, { f: 5 })
        s.mark(t, 'Tierces')
        t = s.line('L', t, 1, ['C3', 'E3', 'D3', 'F3', 'E3', 'G3', 'F3', 'D3'], [5, 3, 4, 2, 3, 1, 2, 4])
        t = s.line('L', t, 1, ['E3', 'C3', 'D3', 'F3', 'E3', 'D3'], [3, 5, 4, 2, 3, 4])
        s.play('L', 'C3', t, 2, { f: 5 })
      },
    },
    {
      id: 'mains-ensemble',
      title: 'Les deux mains ensemble',
      goal: 'Coordonner les mains : d’abord en miroir, puis une main tient pendant que l’autre bouge.',
      explain: [
        'Partie 1 : les deux mains jouent les mêmes notes à une octave d’écart.',
        'Partie 2 : la main gauche tient une note longue pendant que la droite joue des noires.',
      ],
      tips: ['Commence chaque main seule (menu ★ → Mains) si c’est difficile.', 'Compte à voix haute : 1, 2, 3, 4.'],
      bpm: 66,
      hands: '2 mains',
      build: (s) => {
        s.mark(0, 'En parallèle')
        let t = 0
        for (let r = 0; r < 2; r++) {
          s.line('L', t, 1, [...C_UP_LH, 'F3', 'E3', 'D3'], [5, 4, 3, 2, 1, 2, 3, 4])
          t = s.line('R', t, 1, [...C_UP, 'F4', 'E4', 'D4'], [1, 2, 3, 4, 5, 4, 3, 2])
        }
        s.play('L', 'C3', t, 4, { f: 5 })
        t = s.play('R', 'C4', t, 4, { f: 1 })
        s.mark(t, 'Une main tient')
        for (const [bass, f, melody] of [
          ['C3', 5, ['E4', 'D4', 'E4', 'C4']],
          ['G3', 1, ['D4', 'E4', 'F4', 'D4']],
          ['C3', 5, ['E4', 'F4', 'G4', 'E4']],
          ['G3', 1, ['D4', 'F4', 'E4', 'D4']],
        ] as [string, number, string[]][]) {
          s.play('L', bass, t, 4, { f, v: 65 })
          t = s.line('R', t, 1, melody)
        }
        s.play('L', 'C3', t, 4, { f: 5, v: 65 })
        s.play('R', 'C4', t, 4, { f: 1 })
      },
    },
    {
      id: 'gamme-do',
      title: 'La gamme de Do majeur',
      goal: 'Jouer 8 notes avec 5 doigts grâce au passage du pouce.',
      explain: [
        'Main droite : 1-2-3 sur Do-Ré-Mi, puis le pouce passe sous la main pour prendre le Fa, et on continue 1-2-3-4-5.',
        'En descendant, c’est le 3 qui passe par-dessus le pouce pour reprendre le Mi.',
        'Main gauche : 5-4-3-2-1, puis le 3 passe par-dessus le pouce sur le La.',
      ],
      tips: ['Le passage du pouce doit être invisible à l’oreille : pas de trou.', 'Le coude reste immobile, c’est le pouce qui voyage.'],
      bpm: 76,
      hands: '2 mains',
      build: (s) => {
        const up = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']
        const down = [...up].reverse()
        s.mark(0, 'Main droite')
        let t = s.line('R', 0, 1, up, [1, 2, 3, 1, 2, 3, 4, 5])
        t = s.line('R', t, 1, down.slice(1), [4, 3, 2, 1, 3, 2, 1])
        t += 1
        const lup = up.map((n) => n.replace('4', '3').replace('5', '4'))
        s.mark(t, 'Main gauche')
        t = s.line('L', t, 1, lup, [5, 4, 3, 2, 1, 3, 2, 1])
        t = s.line('L', t, 1, [...lup].reverse().slice(1), [2, 3, 1, 2, 3, 4, 5])
        t += 1
        s.mark(t, 'Les deux (lent)')
        s.line('R', t, 2, up, [1, 2, 3, 1, 2, 3, 4, 5])
        s.line('L', t, 2, lup, [5, 4, 3, 2, 1, 3, 2, 1])
      },
    },
    {
      id: 'accords-do-fa-sol',
      title: 'Accords de Do, Fa et Sol',
      goal: 'Plaquer les trois accords principaux et passer de l’un à l’autre sans regarder.',
      explain: [
        'Un accord majeur = 3 notes espacées d’une tierce. Do = Do-Mi-Sol.',
        'À gauche, on ne déplace presque pas la main : Fa se joue Do-Fa-La et Sol se joue Si-Ré-Sol (renversements).',
        'Ces trois accords suffisent à accompagner des centaines de chansons.',
      ],
      tips: ['Les notes doivent sonner exactement ensemble.', 'Repère les notes communes entre deux accords : elles ne bougent pas.'],
      bpm: 70,
      hands: '2 mains',
      build: (s) => {
        const lh: Record<string, V> = { C: ['C3', 'E3', 'G3'], F: ['C3', 'F3', 'A3'], G: ['B2', 'D3', 'G3'] }
        const rh: Record<string, V> = { C: ['C4', 'E4', 'G4'], F: ['C4', 'F4', 'A4'], G: ['B3', 'D4', 'G4'] }
        const names: Record<string, string> = { C: 'Do', F: 'Fa', G: 'Sol' }
        const grid = ['C', 'F', 'C', 'G', 'C', 'F', 'G', 'C']
        let t = bars(s, 0, grid, (c, at) => s.play('L', lh[c], at, 4), (c) => `${names[c]} · MG`)
        t = bars(s, t, grid, (c, at) => {
          s.play('L', lh[c], at, 4, { v: 65 })
          s.play('R', rh[c], at, 2)
          s.play('R', rh[c], at + 2, 2)
        }, (c) => names[c])
      },
    },
    {
      id: 'au-clair-de-la-lune',
      title: 'Au clair de la lune',
      goal: 'Une vraie mélodie à droite, accompagnée par les accords appris à gauche.',
      explain: [
        'Chanson traditionnelle, dans le domaine public.',
        'La main gauche change d’accord quand la mélodie passe par Ré (Sol) ou par La (Fa).',
      ],
      tips: ['Fais chanter la mélodie un peu plus fort que l’accompagnement.', 'Travaille d’abord la main droite seule.'],
      bpm: 84,
      hands: '2 mains',
      build: (s) => {
        const C: V = ['C3', 'E3', 'G3']
        const G: V = ['B2', 'D3', 'G3']
        const F: V = ['C3', 'F3', 'A3']
        const phraseA = (at: number) => {
          s.rhythm('R', at, [['C4', 1], ['C4', 1], ['C4', 1], ['D4', 1], ['E4', 2], ['D4', 2], ['C4', 1], ['E4', 1], ['D4', 1], ['D4', 1], ['C4', 4]])
          s.rhythm('L', at, [[C, 4], [C, 2], [G, 2], [C, 2], [G, 2], [C, 4]], 60)
          return at + 16
        }
        s.mark(0, 'Au clair de la lune…')
        let t = phraseA(0)
        t = phraseA(t)
        s.mark(t, 'Ma chandelle est morte…')
        s.rhythm('R', t, [['D4', 1], ['D4', 1], ['D4', 1], ['D4', 1], ['A3', 2], ['A3', 2], ['D4', 1], ['C4', 1], ['B3', 1], ['A3', 1], ['G3', 4]])
        s.rhythm('L', t, [[G, 4], [F, 4], [G, 4], [G, 4]], 60)
        t += 16
        s.mark(t, 'Ouvre-moi ta porte…')
        phraseA(t)
      },
    },
  ],
}

// ---------- Accompagnement pop ----------

const POP = ['C', 'G', 'Am', 'F']
const POP_ROOT: Record<string, string> = { C: 'C3', G: 'G2', Am: 'A2', F: 'F2' }
const POP_BLOCK: Record<string, V> = { C: ['C4', 'E4', 'G4'], G: ['G3', 'B3', 'D4'], Am: ['A3', 'C4', 'E4'], F: ['F3', 'A3', 'C4'] }
const POP_SMOOTH: Record<string, V> = { C: ['C4', 'E4', 'G4'], G: ['B3', 'D4', 'G4'], Am: ['C4', 'E4', 'A4'], F: ['C4', 'F4', 'A4'] }
const POP_NAME: Record<string, string> = { C: 'Do', G: 'Sol', Am: 'La m', F: 'Fa' }

function arpeggio(root: string, minor: boolean) {
  const r = Number.parseInt(String(root.match(/\d/)?.[0])) // octave
  const base = ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 } as Record<string, number>)[root[0]] + 12 * (r + 1)
  const third = minor ? 15 : 16
  return [0, 7, 12, third, 12, 7, 12, 7].map((i) => base + i)
}

const pop: Program = {
  id: 'pop',
  title: 'Accompagnement pop',
  style: 'Pop',
  level: 'Débutant +',
  summary: 'La suite d’accords la plus utilisée de la pop, puis les gestes pour l’accompagner : renversements, pulsation, arpèges, syncopes.',
  hue: 330,
  lessons: [
    {
      id: '4-accords',
      title: 'Les 4 accords magiques',
      goal: 'Enchaîner Do – Sol – La mineur – Fa (I – V – vi – IV).',
      explain: [
        'Cette suite revient dans un nombre immense de chansons pop, dans toutes les tonalités.',
        'La main gauche joue la fondamentale (la note qui donne son nom à l’accord), la droite l’accord complet.',
      ],
      tips: ['Anticipe : regarde l’accord suivant pendant que tu tiens le précédent.'],
      bpm: 76,
      hands: '2 mains',
      build: (s) => {
        bars(s, 0, [...POP, ...POP, 'C'], (c, at) => {
          s.play('L', POP_ROOT[c], at, 4, { v: 70 })
          s.play('R', POP_BLOCK[c], at, 4)
        }, (c) => POP_NAME[c])
      },
    },
    {
      id: 'renversements',
      title: 'Renversements : enchaîner sans sauter',
      goal: 'Garder la main droite au même endroit en réorganisant les notes des accords.',
      explain: [
        'Un renversement garde les mêmes notes dans un autre ordre. Sol = Sol-Si-Ré peut se jouer Si-Ré-Sol.',
        'Résultat : d’un accord à l’autre, une ou deux notes seulement bougent, d’un ton au plus. C’est plus fluide et plus facile.',
      ],
      tips: ['Compare avec la leçon précédente : la main ne saute plus.', 'Le pouce reste sur Do ou Si pendant toute la grille.'],
      bpm: 76,
      hands: '2 mains',
      build: (s) => {
        bars(s, 0, [...POP, ...POP, 'C'], (c, at) => {
          s.play('L', POP_ROOT[c], at, 4, { v: 70 })
          s.play('R', POP_SMOOTH[c], at, 4)
        }, (c) => POP_NAME[c])
      },
    },
    {
      id: 'pulsation',
      title: 'Pulsation : basse et accords',
      goal: 'Donner le rythme : la basse sur le 1, les accords sur chaque temps.',
      explain: [
        'La main gauche joue la fondamentale en octave sur le premier temps de chaque mesure.',
        'La main droite répète l’accord sur les 4 temps : c’est le moteur rythmique de la chanson.',
      ],
      tips: ['Accords courts et légers, basse longue et profonde.', 'Le temps 1 un peu plus appuyé que les autres.'],
      bpm: 92,
      hands: '2 mains',
      build: (s) => {
        bars(s, 0, [...POP, ...POP, ...POP, 'C'], (c, at, i) => {
          const root = POP_ROOT[c]
          s.play('L', [root.replace(/\d/, (o) => String(Number(o) - 1)), root], at, 4, { v: 75 })
          if (i === 12) s.play('R', POP_SMOOTH[c], at, 4)
          else for (let b = 0; b < 4; b++) s.play('R', POP_SMOOTH[c], at + b, 1, { v: b === 0 ? 80 : 62 })
        }, (c) => POP_NAME[c])
      },
    },
    {
      id: 'arpeges',
      title: 'Arpèges à la main gauche',
      goal: 'Remplir l’espace avec des accords égrenés : fondamentale, quinte, octave, tierce.',
      explain: [
        'Au lieu de plaquer l’accord, la main gauche joue ses notes une par une en croches.',
        'Motif : 1 – 5 – 8 – 10 – 8 – 5 – 8 – 5. Il s’adapte à tous les accords, majeurs comme mineurs.',
      ],
      tips: ['Main gauche détendue, ouverte sur une octave et demie.', 'Utilise la pédale (si tu en as une) en la changeant à chaque accord.'],
      bpm: 72,
      hands: '2 mains',
      build: (s) => {
        bars(s, 0, [...POP, ...POP, 'C'], (c, at, i) => {
          if (i === 8) {
            s.play('L', ['C2', 'C3'], at, 4)
            s.play('R', POP_SMOOTH[c], at, 4)
            return
          }
          s.line('L', at, 0.5, arpeggio(POP_ROOT[c].replace(/\d/, (o) => String(Number(o) - 1)), c === 'Am'), undefined, 70)
          s.play('R', POP_SMOOTH[c], at, 4, { v: 70 })
        }, (c) => POP_NAME[c])
      },
    },
    {
      id: 'syncopes',
      title: 'Rythme syncopé 3-3-2',
      goal: 'Le rythme qui fait danser : trois coups décalés par mesure.',
      explain: [
        'On découpe la mesure en 8 croches regroupées 3 + 3 + 2. Les accords tombent sur la 1re, la 4e et la 7e croche.',
        'Les deux mains jouent ce rythme ensemble.',
      ],
      tips: ['Compte « 1 et 2 et 3 et 4 et » : les coups tombent sur 1, le « et » de 2, et 4.', 'Commence à ×0,6 avec la boucle.'],
      bpm: 96,
      hands: '2 mains',
      build: (s) => {
        bars(s, 0, [...POP, ...POP, 'C'], (c, at, i) => {
          const root = POP_ROOT[c]
          if (i === 8) {
            s.play('L', root, at, 4)
            s.play('R', POP_SMOOTH[c], at, 4)
            return
          }
          for (const [o, len] of [[0, 1.5], [1.5, 1.5], [3, 1]]) {
            s.play('L', root, at + o, len, { v: 72 })
            s.play('R', POP_SMOOTH[c], at + o, len, { v: o === 0 ? 82 : 72 })
          }
        }, (c) => POP_NAME[c])
      },
    },
    {
      id: 'ballade',
      title: 'Ballade : mélodie et arpèges',
      goal: 'Tout réunir : une mélodie simple à droite sur les arpèges de gauche.',
      explain: [
        'La mélodie (originale) n’utilise que des notes des accords : elle tombe toujours juste.',
        'C’est le schéma de la plupart des ballades au piano.',
      ],
      tips: ['Mélodie chantante et legato, arpèges discrets.', 'Travaille 2 mesures en boucle, puis allonge.'],
      bpm: 70,
      hands: '2 mains',
      build: (s) => {
        const melody: Record<string, [string, number][]> = {
          C: [['E4', 1], ['G4', 1], ['C5', 2]],
          G: [['B4', 1], ['A4', 1], ['G4', 2]],
          Am: [['A4', 1], ['C5', 1], ['E5', 2]],
          F: [['C5', 1], ['A4', 1], ['F4', 2]],
        }
        bars(s, 0, [...POP, ...POP, 'C'], (c, at, i) => {
          if (i === 8) {
            s.play('L', ['C2', 'C3'], at, 4)
            s.play('R', ['E4', 'G4', 'C5'], at, 4)
            return
          }
          s.line('L', at, 0.5, arpeggio(POP_ROOT[c].replace(/\d/, (o) => String(Number(o) - 1)), c === 'Am'), undefined, 58)
          s.rhythm('R', at, melody[c], 88)
        }, (c) => POP_NAME[c])
      },
    },
  ],
}

// ---------- Blues ----------

const BLUES_GRID = ['C7', 'C7', 'C7', 'C7', 'F7', 'F7', 'C7', 'C7', 'G7', 'F7', 'C7', 'G7']
const BLUES_ROOT: Record<string, string> = { C7: 'C3', F7: 'F2', G7: 'G2' }
const BLUES_LH: Record<string, V> = { C7: ['C3', 'E3', 'Bb3'], F7: ['F2', 'A2', 'Eb3'], G7: ['G2', 'B2', 'F3'] }
const semis = (name: string, n: number) => {
  const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
  const m = /^([A-G][#b]?)(\d)$/.exec(name)!
  const idx = NAMES.indexOf(m[1].replace('Db', 'C#').replace('D#', 'Eb').replace('Gb', 'F#').replace('G#', 'Ab').replace('A#', 'Bb'))
  const total = idx + 12 * Number(m[2]) + n
  return `${NAMES[((total % 12) + 12) % 12]}${Math.floor(total / 12)}`
}

function shuffle(s: Score, c: string, at: number, v = 70) {
  const r = BLUES_ROOT[c]
  for (let b = 0; b < 4; b++) {
    const top = semis(r, b % 2 ? 9 : 7)
    s.play('L', [r, top], at + b, 0.5, { v })
    s.play('L', [r, top], at + b + 0.5, 0.5, { v: v - 12 })
  }
}

function boogie(s: Score, c: string, at: number, v = 72) {
  const r = BLUES_ROOT[c]
  s.line('L', at, 0.5, [0, 4, 7, 9, 10, 9, 7, 4].map((i) => semis(r, i)), undefined, v)
}

const blues: Program = {
  id: 'blues',
  title: 'Le blues',
  style: 'Blues',
  level: 'Intermédiaire',
  summary: 'La gamme blues, la grille de 12 mesures, le shuffle et le boogie-woogie à gauche, puis tes premiers licks.',
  hue: 220,
  lessons: [
    {
      id: 'gamme-blues',
      title: 'La gamme blues',
      goal: 'Connaître les 6 notes qui sonnent « blues » : Do, Mi♭, Fa, Fa♯, Sol, Si♭.',
      explain: [
        'C’est la gamme pentatonique mineure plus une note de passage, la « blue note » Fa♯.',
        'Deuxième partie : un premier motif en croches swing (la 1re croche longue, la 2e courte).',
      ],
      tips: ['Doigté MD conseillé : 1-2-3-4-1-3-4 (le pouce repasse sur Sol).', 'Le Fa♯ ne s’attarde jamais : il glisse vers le Sol.'],
      bpm: 80,
      swing: true,
      hands: 'MD',
      build: (s) => {
        const up = ['C4', 'Eb4', 'F4', 'F#4', 'G4', 'Bb4', 'C5']
        s.mark(0, 'Gamme')
        let t = s.line('R', 0, 1, up, [1, 2, 3, 4, 1, 3, 4])
        t = s.line('R', t, 1, [...up].reverse().slice(1), [3, 1, 4, 3, 2, 1])
        t += 1
        s.mark(t, 'Motif swing')
        for (let r = 0; r < 4; r++) {
          t = s.line('R', t, 0.5, ['G4', 'Bb4', 'C5', 'Bb4', 'G4', 'F#4', 'F4', 'Eb4'])
          t = s.rhythm('R', t, [['C4', 2], [null, 2]])
        }
      },
    },
    {
      id: 'grille-12',
      title: 'La grille de 12 mesures',
      goal: 'Mémoriser la structure du blues : 4 mesures de Do7, 2 de Fa7, 2 de Do7, puis Sol7 – Fa7 – Do7 – Sol7.',
      explain: [
        'Presque tous les blues suivent ce plan, qui revient en boucle (chaque tour s’appelle un « chorus »).',
        'Les accords sont des accords de septième (avec la 7e mineure) : c’est elle qui donne la couleur blues.',
      ],
      tips: ['Compte les mesures à voix haute : la structure doit devenir automatique.', 'Repère le retour à Do7 en mesure 7 et 11.'],
      bpm: 84,
      hands: 'MG',
      build: (s) => {
        bars(s, 0, [...BLUES_GRID, 'C7'], (c, at) => s.play('L', BLUES_LH[c], at, 4), (c) => c.replace('C', 'Do').replace('F', 'Fa').replace('G', 'Sol'))
      },
    },
    {
      id: 'shuffle',
      title: 'Le shuffle à la main gauche',
      goal: 'Le balancement typique du blues : quinte, sixte, quinte, sixte, en croches swing.',
      explain: [
        'Le pouce alterne entre la quinte et la sixte pendant que le 5 garde la fondamentale.',
        'Le motif se déplace tel quel sur Fa7 et Sol7.',
      ],
      tips: ['Le 5e doigt ne bouge pas, seul le pouce oscille.', 'Ressens le ternaire : « long-court, long-court ».'],
      bpm: 96,
      swing: true,
      hands: 'MG',
      build: (s) => {
        const t = bars(s, 0, BLUES_GRID, (c, at) => shuffle(s, c, at), (c) => c)
        s.play('L', ['C3', 'G3'], t, 4)
      },
    },
    {
      id: 'boogie',
      title: 'La basse boogie-woogie',
      goal: 'La main gauche qui marche : 1-3-5-6-♭7-6-5-3 sur chaque accord.',
      explain: [
        'Une ligne de basse en croches swing qui monte et redescend l’accord avec la sixte et la septième.',
        'C’est le moteur du boogie-woogie et du rock’n’roll.',
      ],
      tips: ['Doigté : 5-3-2-1 en montant, puis 1-2-3 en redescendant (sans changer de position).', 'Vise la régularité absolue avant la vitesse.'],
      bpm: 88,
      swing: true,
      hands: 'MG',
      build: (s) => {
        const t = bars(s, 0, BLUES_GRID, (c, at) => boogie(s, c, at), (c) => c)
        s.play('L', 'C3', t, 4)
      },
    },
    {
      id: 'premier-lick',
      title: 'Ton premier lick',
      goal: 'Une phrase de 2 mesures à droite, placée sur le shuffle de gauche.',
      explain: [
        'La gamme blues fonctionne sur les trois accords : le même lick sonne sur Do7, Fa7 et Sol7.',
        'Le blues est un dialogue : 2 mesures de phrase, 2 mesures de réponse (ici, un silence pour écouter la main gauche).',
        'Le Mi♭ qui glisse vers le Mi est l’effet blues par excellence.',
      ],
      tips: ['Travaille d’abord le lick seul (Mains → Droite), puis ajoute la gauche.'],
      bpm: 88,
      swing: true,
      hands: '2 mains',
      build: (s) => {
        const lick = (at: number) => {
          s.line('R', at, 0.5, ['G4', 'Bb4', 'C5', 'Bb4', 'G4', 'F4'])
          s.rhythm('R', at + 3, [['Eb4', 0.5], ['E4', 0.5], ['C4', 3]])
        }
        const t = bars(s, 0, BLUES_GRID, (c, at, i) => {
          shuffle(s, c, at, 62)
          if (i % 4 === 0) lick(at)
        }, (c) => c)
        s.play('L', ['C3', 'G3'], t, 4)
        s.play('R', ['E4', 'Bb4', 'C5'], t, 4)
      },
    },
    {
      id: 'blues-complet',
      title: 'Blues complet en Do',
      goal: 'Deux chorus : accords puis licks, sur le boogie, avec un turnaround final.',
      explain: [
        'Chorus 1 : la droite plaque les accords sur les contretemps pendant que la gauche joue le boogie.',
        'Chorus 2 : licks en question-réponse.',
        'Turnaround (mesures 11-12) : une descente chromatique qui relance la grille.',
      ],
      tips: ['Utilise la boucle A-B sur les passages durs.', 'Une fois à l’aise, invente tes propres licks avec la gamme blues.'],
      bpm: 92,
      swing: true,
      hands: '2 mains',
      build: (s) => {
        const RH: Record<string, V> = { C7: ['E4', 'G4', 'Bb4'], F7: ['Eb4', 'F4', 'A4'], G7: ['F4', 'G4', 'B4'] }
        let t = bars(s, 0, BLUES_GRID, (c, at) => {
          boogie(s, c, at, 66)
          s.play('R', RH[c], at + 1.5, 0.5, { v: 76 })
          s.play('R', RH[c], at + 3, 1, { v: 70 })
        }, (c) => `${c} · chorus 1`)
        t = bars(s, t, BLUES_GRID, (c, at, i) => {
          boogie(s, c, at, 62)
          if (i === 10) s.line('R', at, 0.5, ['C5', 'B4', 'Bb4', 'A4', 'Ab4', 'G4', null, null])
          else if (i === 11) s.play('R', ['F4', 'G4', 'B4'], at, 2)
          else if (i % 2 === 0) {
            s.line('R', at, 0.5, ['G4', 'Bb4', 'C5', 'Eb5', 'C5', 'Bb4'])
            s.rhythm('R', at + 3, [['G4', 0.5], ['F4', 0.5]])
          } else s.rhythm('R', at, [['Eb4', 0.5], ['E4', 0.5], ['C4', 1.5]])
        }, (c) => `${c} · chorus 2`)
        s.play('L', ['C2', 'C3'], t, 4)
        s.play('R', ['E4', 'G4', 'Bb4', 'C5'], t, 4)
      },
    },
  ],
}

// ---------- Jazz ----------

const ROOTLESS: Record<string, V> = {
  Dm7: ['F4', 'A4', 'C5', 'E5'],
  G7: ['F4', 'A4', 'B4', 'E5'],
  Cmaj7: ['E4', 'G4', 'B4', 'D5'],
  A7: ['C#4', 'F#4', 'G4', 'B4'],
}
const JAZZ_ROOT: Record<string, string> = { Dm7: 'D3', G7: 'G2', Cmaj7: 'C3', A7: 'A2' }
const II_V_I = ['Dm7', 'G7', 'Cmaj7', 'Cmaj7']

const jazz: Program = {
  id: 'jazz',
  title: 'Les bases du jazz',
  style: 'Jazz',
  level: 'Intermédiaire +',
  summary: 'Accords de septième, II-V-I, voicings sans fondamentale, walking bass, swing et première ligne bebop.',
  hue: 40,
  lessons: [
    {
      id: 'septiemes',
      title: 'Les 4 accords de septième',
      goal: 'Entendre et jouer Cmaj7, C7, Cm7 et Cm7♭5 sur la même fondamentale.',
      explain: [
        'Le jazz empile 4 notes au lieu de 3 : on ajoute la septième à l’accord.',
        'maj7 (lumineux), 7 (tendu, dominante), m7 (doux), m7♭5 (sombre). Seules 1 ou 2 notes changent de l’un à l’autre.',
      ],
      tips: ['Écoute la note qui change à chaque fois.', 'Arpège d’abord, puis plaque.'],
      bpm: 80,
      hands: '2 mains',
      build: (s) => {
        const chords: [string, string[]][] = [
          ['Cmaj7', ['C4', 'E4', 'G4', 'B4']],
          ['C7', ['C4', 'E4', 'G4', 'Bb4']],
          ['Cm7', ['C4', 'Eb4', 'G4', 'Bb4']],
          ['Cm7♭5', ['C4', 'Eb4', 'Gb4', 'Bb4']],
        ]
        let t = 0
        for (const [name, notes] of chords) {
          s.mark(t, name)
          s.play('L', 'C3', t, 4, { v: 60 })
          s.line('R', t, 0.5, [...notes, ...[...notes].reverse()], [1, 2, 3, 5, 5, 3, 2, 1])
          t = s.play('R', notes, t + 4, 4)
          s.play('L', 'C3', t - 4, 4, { v: 60 })
        }
      },
    },
    {
      id: 'ii-v-i-shells',
      title: 'Le II-V-I avec les shells',
      goal: 'La progression reine du jazz, jouée avec seulement 2 notes par accord.',
      explain: [
        'II-V-I en Do : Dm7 → G7 → Cmaj7. On la retrouve dans presque tous les standards.',
        'Shell = fondamentale + tierce ou septième. À gauche : Ré-Do, Sol-Si, Do-Si : la main bouge à peine.',
        'Partie 2 : la droite ajoute les « notes guides » (tierces et septièmes) qui glissent d’un demi-ton.',
      ],
      tips: ['Écoute la ligne Do → Si dans l’aigu : c’est la résolution.', 'Tiens chaque accord sa valeur entière.'],
      bpm: 72,
      hands: '2 mains',
      build: (s) => {
        const shells: Record<string, V> = { Dm7: ['D3', 'C4'], G7: ['G2', 'B2'], Cmaj7: ['C3', 'B3'] }
        const guides: Record<string, V> = { Dm7: ['F4', 'C5'], G7: ['F4', 'B4'], Cmaj7: ['E4', 'B4'] }
        let t = bars(s, 0, [...II_V_I, ...II_V_I], (c, at) => s.play('L', shells[c], at, 4), (c) => `${c} · shells`)
        bars(s, t, [...II_V_I, ...II_V_I], (c, at) => {
          s.play('L', shells[c], at, 4, { v: 65 })
          s.play('R', guides[c], at, 4)
        }, (c) => `${c} · + notes guides`)
      },
    },
    {
      id: 'rootless',
      title: 'Voicings sans fondamentale',
      goal: 'Le son « piano jazz » : 4 notes à droite, la basse à gauche.',
      explain: [
        'La droite joue 3e, 5e, 7e et 9e (ou 13e) sans la fondamentale, laissée à la main gauche ou au bassiste.',
        'Dm9 → G13 → Cmaj9 : on passe de l’un à l’autre en bougeant 1 ou 2 doigts.',
        'Partie 2 : rythme « Charleston » : sur le 1 et sur le « et » du 2.',
      ],
      tips: ['Note qui bouge entre Dm9 et G13 : seulement le Do qui descend au Si.', 'Swing : le contretemps arrive tard.'],
      bpm: 84,
      swing: true,
      hands: '2 mains',
      build: (s) => {
        let t = bars(s, 0, [...II_V_I, ...II_V_I], (c, at) => {
          s.play('L', JAZZ_ROOT[c], at, 4, { v: 68 })
          s.play('R', ROOTLESS[c], at, 4)
        }, (c) => c)
        t = bars(s, t, [...II_V_I, ...II_V_I], (c, at) => {
          s.play('L', JAZZ_ROOT[c], at, 2, { v: 68 })
          s.play('L', JAZZ_ROOT[c], at + 2, 2, { v: 58 })
          s.play('R', ROOTLESS[c], at, 1, { v: 78 })
          s.play('R', ROOTLESS[c], at + 1.5, 1, { v: 72 })
        }, (c) => `${c} · Charleston`)
      },
    },
    {
      id: 'walking',
      title: 'Walking bass et comping',
      goal: 'La gauche marche à la noire, la droite accompagne sur 2 et 4.',
      explain: [
        'Walking bass : une note par temps, les notes de l’accord, puis une note d’approche à un demi-ton de la fondamentale suivante.',
        'Grille I-vi-ii-V inversée en ii-V-I-VI (Dm7, G7, Cmaj7, A7) qui tourne en boucle.',
        'La droite « compe » : accords courts sur les temps 2 et 4, comme le charleston de la batterie.',
      ],
      tips: ['La basse doit être parfaitement égale : c’est le métronome du groupe.', 'Travaille la gauche seule en premier.'],
      bpm: 100,
      hands: '2 mains',
      build: (s) => {
        const walk: Record<string, string[]> = {
          Dm7: ['D3', 'F3', 'A3', 'Ab3'],
          G7: ['G3', 'F3', 'D3', 'Db3'],
          Cmaj7: ['C3', 'E3', 'G3', 'G#3'],
          A7: ['A3', 'G3', 'E3', 'Eb3'],
        }
        const grid = ['Dm7', 'G7', 'Cmaj7', 'A7']
        const t = bars(s, 0, [...grid, ...grid, ...grid], (c, at) => {
          s.line('L', at, 1, walk[c], undefined, 74)
          s.play('R', ROOTLESS[c], at + 1, 0.5, { v: 66 })
          s.play('R', ROOTLESS[c], at + 3, 0.5, { v: 66 })
        }, (c) => c)
        s.play('L', 'D3', t, 4)
        s.play('R', ROOTLESS.Dm7, t, 4)
      },
    },
    {
      id: 'bebop',
      title: 'Une ligne bebop sur II-V-I',
      goal: 'Improviser à la croche : une phrase qui suit les accords et résout sur la tierce de Cmaj7.',
      explain: [
        'Les lignes jazz enchaînent des croches swing qui arpègent l’accord et passent par des notes chromatiques.',
        'Repère où tombent les notes des accords sur les temps forts : c’est ce qui fait sonner la ligne.',
      ],
      tips: ['Accentue légèrement les contretemps : c’est le secret du swing.', 'Chante la ligne avant de la jouer.'],
      bpm: 112,
      swing: true,
      hands: '2 mains',
      build: (s) => {
        const shells: Record<string, V> = { Dm7: ['D3', 'C4'], G7: ['G2', 'B2'], Cmaj7: ['C3', 'B3'] }
        let t = 0
        for (let r = 0; r < 3; r++) {
          bars(s, t, II_V_I, (c, at) => s.play('L', shells[c], at, 4, { v: 60 }), (c) => c)
          s.line('R', t, 0.5, ['D4', 'E4', 'F4', 'G4', 'A4', 'C5', 'B4', 'A4'])
          s.line('R', t + 4, 0.5, ['G4', 'B4', 'D5', 'F5', 'E5', 'Eb5', 'D5', 'B4'])
          s.rhythm('R', t + 8, [['C5', 2], ['B4', 1], ['G4', 1], ['E4', 4]])
          t += 16
        }
        s.play('L', ['C3', 'B3'], t, 4)
        s.play('R', ROOTLESS.Cmaj7, t, 4)
      },
    },
    {
      id: 'turnaround',
      title: 'Le turnaround I-VI-II-V',
      goal: 'Deux accords par mesure, en voicings sans fondamentale qui s’enchaînent en douceur.',
      explain: [
        'Cmaj9 → A13 → Dm9 → G13 : la boucle qui termine (et relance) d’innombrables standards.',
        'Chaque voix descend ou reste : la main droite ne fait presque que glisser.',
      ],
      tips: ['Écoute la voix du haut : Ré, Si, Mi, Mi.', 'Puis passe au Charleston (partie 2).'],
      bpm: 88,
      swing: true,
      hands: '2 mains',
      build: (s) => {
        const pairs: [string, string][] = [['Cmaj7', 'A7'], ['Dm7', 'G7']]
        const run = (at: number, charleston: boolean) => {
          for (let i = 0; i < 4; i++) {
            const [a, b] = pairs[i % 2]
            const bar = at + i * 4
            s.mark(bar, `${a} – ${b}${charleston ? ' · rythmé' : ''}`)
            for (const [c, o] of [[a, 0], [b, 2]] as [string, number][]) {
              s.play('L', JAZZ_ROOT[c], bar + o, 2, { v: 66 })
              if (charleston) {
                s.play('R', ROOTLESS[c], bar + o, 0.5, { v: 76 })
                s.play('R', ROOTLESS[c], bar + o + 1.5, 0.5, { v: 70 })
              } else s.play('R', ROOTLESS[c], bar + o, 2)
            }
          }
          return at + 16
        }
        let t = run(0, false)
        t = run(t, true)
        s.play('L', ['C3', 'G3'], t, 4)
        s.play('R', ROOTLESS.Cmaj7, t, 4)
      },
    },
  ],
}

// ---------- Bossa nova ----------

const BOSSA = ['Cmaj7', 'Cmaj7', 'D7', 'D7', 'Dm7', 'G7', 'Cmaj7', 'Cmaj7']
const BOSSA_ROOT: Record<string, [string, string]> = {
  Cmaj7: ['C3', 'G2'],
  D7: ['D3', 'A2'],
  Dm7: ['D3', 'A2'],
  G7: ['G2', 'D3'],
}
const BOSSA_RH: Record<string, V> = {
  Cmaj7: ['E4', 'G4', 'B4', 'D5'],
  D7: ['F#4', 'A4', 'C5', 'E5'],
  Dm7: ['F4', 'A4', 'C5', 'E5'],
  G7: ['F4', 'A4', 'B4', 'E5'],
}
// Clave de bossa sur 2 mesures (en temps)
const CLAVE = [0, 1.5, 3, 5, 6.5]

function bossaBass(s: Score, c: string, at: number, v = 72) {
  const [r, fifth] = BOSSA_ROOT[c]
  s.rhythm('L', at, [[r, 1.5], [fifth, 0.5], [fifth, 1.5], [r, 0.5]], v)
}

function batida(s: Score, chords: string[], at: number, v = 66) {
  // Une figure de clave couvre 2 mesures
  for (const o of CLAVE) s.play('R', BOSSA_RH[chords[Math.floor(o / 4)]], at + o, 0.5, { v })
}

const bossa: Program = {
  id: 'bossa',
  title: 'Bossa nova',
  style: 'Latin',
  level: 'Intermédiaire',
  summary: 'La basse balancée, la clave syncopée des accords et une mélodie douce, le tout en croches droites.',
  hue: 150,
  lessons: [
    {
      id: 'basse',
      title: 'La basse de bossa',
      goal: 'Fondamentale et quinte en rythme pointé, qui berce chaque mesure.',
      explain: [
        'La main gauche imite le surdo (la grosse caisse brésilienne) : fondamentale, quinte, quinte, fondamentale.',
        'Rythme : noire pointée + croche, deux fois par mesure. Croches droites, pas de swing.',
        'La droite tient les accords en fond pour l’oreille.',
      ],
      tips: ['Basse souple et régulière, jamais lourde.', 'Ressens la mesure « à 2 temps ».'],
      bpm: 110,
      hands: 'MG',
      build: (s) => {
        const t = bars(s, 0, [...BOSSA, ...BOSSA], (c, at) => {
          bossaBass(s, c, at)
          s.play('R', BOSSA_RH[c], at, 4, { v: 45 })
        }, (c) => c)
        s.play('L', 'C3', t, 4)
      },
    },
    {
      id: 'batida',
      title: 'La clave des accords',
      goal: 'Placer les accords sur la clave de bossa : 5 coups répartis sur 2 mesures.',
      explain: [
        'Les accords tombent sur le 1, le « et » du 2, le 4, puis le 2 et le « et » du 3 de la mesure suivante.',
        'Les accords sont courts et légers, comme la guitare de bossa.',
        'La gauche tient seulement la fondamentale pour l’instant.',
      ],
      tips: ['Compte les croches « 1 et 2 et 3 et 4 et » et vise les bonnes.', 'Utilise la boucle sur 2 mesures.'],
      bpm: 100,
      hands: 'MD',
      build: (s) => {
        let t = 0
        for (let r = 0; r < 2; r++) {
          for (let i = 0; i < BOSSA.length; i += 2) {
            s.mark(t, BOSSA[i] === BOSSA[i + 1] ? BOSSA[i] : `${BOSSA[i]} – ${BOSSA[i + 1]}`)
            batida(s, [BOSSA[i], BOSSA[i + 1]], t)
            s.play('L', BOSSA_ROOT[BOSSA[i]][0], t, 4, { v: 55 })
            s.play('L', BOSSA_ROOT[BOSSA[i + 1]][0], t + 4, 4, { v: 55 })
            t += 8
          }
        }
        s.play('R', BOSSA_RH.Cmaj7, t, 4)
        s.play('L', 'C3', t, 4)
      },
    },
    {
      id: 'ensemble',
      title: 'Basse et accords ensemble',
      goal: 'Superposer la basse régulière et la clave syncopée.',
      explain: [
        'C’est l’indépendance des mains : la gauche reste stable, la droite est décalée.',
        'Si ça coince, joue en boucle une seule paire de mesures à ×0,6.',
      ],
      tips: ['La gauche ne doit jamais se caler sur le rythme de la droite.'],
      bpm: 100,
      hands: '2 mains',
      build: (s) => {
        let t = 0
        for (let r = 0; r < 2; r++) {
          for (let i = 0; i < BOSSA.length; i += 2) {
            s.mark(t, BOSSA[i] === BOSSA[i + 1] ? BOSSA[i] : `${BOSSA[i]} – ${BOSSA[i + 1]}`)
            bossaBass(s, BOSSA[i], t)
            bossaBass(s, BOSSA[i + 1], t + 4)
            batida(s, [BOSSA[i], BOSSA[i + 1]], t)
            t += 8
          }
        }
        s.play('R', BOSSA_RH.Cmaj7, t, 4)
        s.play('L', 'C3', t, 4)
      },
    },
    {
      id: 'melodie',
      title: 'Mélodie bossa',
      goal: 'Une mélodie syncopée (originale) à droite sur la basse de bossa.',
      explain: [
        'La mélodie reprend le rythme pointé de la basse et se pose sur les 7e et 9e des accords : c’est la douceur bossa.',
        'Joue-la legato, sans forcer.',
      ],
      tips: ['Mélodie au-dessus, basse en retrait.', 'Une fois à l’aise, ajoute la clave dans les mesures où la mélodie se tait.'],
      bpm: 100,
      hands: '2 mains',
      build: (s) => {
        const melody: [string | null, number][][] = [
          [['G4', 1.5], ['E4', 0.5], ['G4', 1], ['A4', 1]],
          [['B4', 3], [null, 1]],
          [['A4', 1.5], ['F#4', 0.5], ['A4', 1], ['B4', 1]],
          [['C5', 3], [null, 1]],
          [['A4', 1.5], ['F4', 0.5], ['A4', 1], ['C5', 1]],
          [['B4', 1.5], ['G4', 0.5], ['F4', 1], ['D4', 1]],
          [['E4', 4]],
          [[null, 4]],
        ]
        let t = 0
        for (let r = 0; r < 2; r++) {
          t = bars(s, t, BOSSA, (c, at, i) => {
            bossaBass(s, c, at, 62)
            s.rhythm('R', at, melody[i] as [string | null, number][], 84)
          }, (c) => c)
        }
        s.play('L', 'C3', t, 4)
        s.play('R', BOSSA_RH.Cmaj7, t, 4)
      },
    },
  ],
}

export const PROGRAMS: Program[] = [bases, pop, blues, jazz, bossa]

export const lessonId = (p: Program, l: Lesson) => `lesson-${p.id}-${l.id}`

export function lessonSong(p: Program, l: Lesson): Song {
  const s = new Score(l.bpm, l.swing)
  l.build(s)
  return s.toSong(lessonId(p, l), l.title, p.id, l.id)
}

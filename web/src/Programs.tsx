import { lessonId, type Lesson, type Program } from './lessons/programs'
import { load } from './progress'

const starsOf = (p: Program, l: Lesson, progress = load()) => progress.songs[lessonId(p, l)]?.stars ?? 0

/** Une leçon s'ouvre quand la précédente a au moins une étoile. */
export const isUnlocked = (p: Program, i: number, progress = load()) => i === 0 || starsOf(p, p.lessons[i - 1], progress) > 0

const accent = (p: Program) => ({ '--hue': p.hue }) as React.CSSProperties

export function ProgramList({ programs, onOpen }: { programs: Program[]; onOpen: (p: Program) => void }) {
  const progress = load()
  return (
    <ul className="programs">
      {programs.map((p) => {
        const done = p.lessons.filter((l) => starsOf(p, l, progress) > 0).length
        const next = p.lessons.find((l) => !starsOf(p, l, progress))
        return (
          <li key={p.id}>
            <button className="program-card" style={accent(p)} onClick={() => onOpen(p)}>
              <span className="program-tag">
                {p.style} · {p.level}
              </span>
              <strong>{p.title}</strong>
              <small>{p.summary}</small>
              <span className="program-progress">
                <span className="bar">
                  <i style={{ width: `${(done / p.lessons.length) * 100}%` }} />
                </span>
                {done}/{p.lessons.length}
              </span>
              <span className="program-next">{next ? `À suivre : ${next.title}` : 'Programme terminé ✓'}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function ProgramView({
  program,
  onBack,
  onLesson,
}: {
  program: Program
  onBack: () => void
  onLesson: (l: Lesson) => void
}) {
  const progress = load()
  const current = program.lessons.findIndex((l) => !starsOf(program, l, progress))
  return (
    <div className="program" style={accent(program)}>
      <header className="sub-header">
        <button onClick={onBack} aria-label="Retour">←</button>
        <span>
          <small>
            {program.style} · {program.level}
          </small>
          <h2>{program.title}</h2>
        </span>
      </header>
      <p className="muted">{program.summary}</p>
      <ol className="path">
        {program.lessons.map((l, i) => {
          const stars = starsOf(program, l, progress)
          const open = isUnlocked(program, i, progress)
          const state = stars ? 'done' : open ? (i === current ? 'current' : 'open') : 'locked'
          return (
            <li key={l.id} className={state}>
              <button disabled={!open} onClick={() => onLesson(l)}>
                <span className="step">{stars ? '✓' : open ? i + 1 : '🔒'}</span>
                <span className="path-text">
                  <strong>{l.title}</strong>
                  <small>{open ? l.goal : 'Obtiens une étoile à la leçon précédente'}</small>
                </span>
                <span className="stars small">
                  {'★'.repeat(stars)}
                  <span className="muted">{'☆'.repeat(3 - stars)}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export function LessonView({
  program,
  lesson,
  onBack,
  onStart,
  onNext,
}: {
  program: Program
  lesson: Lesson
  onBack: () => void
  onStart: () => void
  onNext?: () => void
}) {
  const stars = starsOf(program, lesson)
  const index = program.lessons.indexOf(lesson)
  const targets: [number, string][] = [
    [1, `jusqu’au bout à ×0,5 (${Math.round(lesson.bpm / 2)} bpm)`],
    [2, `à ×0,75 (${Math.round(lesson.bpm * 0.75)} bpm)`],
    [3, `au tempo, ×1 (${lesson.bpm} bpm)`],
  ]
  return (
    <div className="lesson" style={accent(program)}>
      <header className="sub-header">
        <button onClick={onBack} aria-label="Retour">←</button>
        <span>
          <small>
            {program.title} · leçon {index + 1}/{program.lessons.length}
          </small>
          <h2>{lesson.title}</h2>
        </span>
      </header>

      <p className="lesson-goal">{lesson.goal}</p>

      <div className="chips">
        <span>{lesson.hands}</span>
        <span>{lesson.bpm} bpm</span>
        {lesson.swing && <span>swing</span>}
      </div>

      <section>
        <h3>Ce que tu travailles</h3>
        <ul>
          {lesson.explain.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Conseils</h3>
        <ul>
          {lesson.tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Objectifs</h3>
        <ul className="targets">
          {targets.map(([n, text]) => (
            <li key={n} className={stars >= n ? 'done' : ''}>
              <span className="stars small">{'★'.repeat(n)}</span> Joue l’exercice {text}
            </li>
          ))}
        </ul>
      </section>

      <div className="lesson-actions">
        <button className="cta" onClick={onStart}>
          {stars ? 'Rejouer l’exercice' : 'Commencer l’exercice'}
        </button>
        {onNext && stars > 0 && (
          <button className="secondary" onClick={onNext}>
            Leçon suivante →
          </button>
        )}
      </div>
    </div>
  )
}

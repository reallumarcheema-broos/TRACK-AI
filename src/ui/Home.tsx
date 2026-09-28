import type { ExerciseId } from '../core/exercise';
import { EXERCISES } from '../exercises';
import { ExerciseFigure } from './ExerciseFigure';
import { IconHistory, IconLock, IconSettings, Logo } from './icons';

const VIEW_LABEL = { side: 'Side-on', front: 'Facing camera', diagonal: 'Angled' } as const;

export function Home(props: { onPick: (id: ExerciseId) => void; onHistory: () => void; onSettings: () => void }) {
  return (
    <main className="page">
      <header className="topbar">
        <div className="brand">
          <Logo />
          <div>
            TRACK AI
            <small>Coach</small>
          </div>
        </div>
        <span className="spacer" />
        <button className="icon-btn" onClick={props.onHistory} aria-label="History">
          <IconHistory />
        </button>
        <button className="icon-btn" onClick={props.onSettings} aria-label="Settings">
          <IconSettings />
        </button>
      </header>

      <section className="hero">
        <h1>
          Your AI trainer, <em>right in your phone.</em>
        </h1>
        <p>
          Prop up your phone, start a set, and train. The coach tracks your body in real time, counts every rep, spots
          bad form the moment it happens and talks you through it.
        </p>
      </section>

      <section className="steps" aria-label="How it works">
        <div className="step">
          <span className="n">1</span>
          <b>Prop it up</b>
          2–3 m away, whole body in view
        </div>
        <div className="step">
          <span className="n">2</span>
          <b>Start moving</b>
          Hold still a second, then go
        </div>
        <div className="step">
          <span className="n">3</span>
          <b>Listen</b>
          Reps, cues and a debrief — out loud
        </div>
      </section>

      <section className="stack" aria-labelledby="pick">
        <h2 id="pick" className="eyebrow">
          Pick an exercise
        </h2>
        <div className="ex-grid">
          {EXERCISES.map((ex) => (
            <button key={ex.id} className="ex-card" onClick={() => props.onPick(ex.id)}>
              <ExerciseFigure id={ex.id} className="figure" />
              <h3>{ex.name}</h3>
              <span className="muscles">{ex.muscles}</span>
              <span className="badge">{VIEW_LABEL[ex.camera.recommended]}</span>
            </button>
          ))}
        </div>
      </section>

      <p className="note">
        <IconLock />
        Private by design: your camera feed is analysed on this device and never uploaded.
      </p>
    </main>
  );
}

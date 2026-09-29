import { useState } from 'react';
import type { ExerciseDef } from '../core/exercise';
import type { FacingMode } from '../pose/camera';
import { hasDemo } from '../media/people';
import { ExerciseArt } from './ExerciseArt';
import { IconBack, IconCamera, IconPlay } from './icons';
import { PlacementDiagram } from './PlacementDiagram';

export interface SetupProps {
  exercise: ExerciseDef;
  target: number;
  facingMode: FacingMode;
  onTarget: (n: number) => void;
  onFacing: (f: FacingMode) => void;
  onStart: (demo: boolean) => void;
  onBack: () => void;
}

export function Setup({ exercise, target, facingMode, onTarget, onFacing, onStart, onBack }: SetupProps) {
  const hold = exercise.kind === 'hold';
  const [starting, setStarting] = useState(false);
  const start = (demo: boolean) => {
    setStarting(true);
    onStart(demo);
  };

  return (
    <main className="page">
      <header className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <IconBack />
        </button>
      </header>

      <section className="setup-head">
        <ExerciseArt id={exercise.id} />
        <div className="stack" style={{ gap: 4 }}>
          <h1>{exercise.name}</h1>
          <p className="muted">{exercise.tagline}</p>
          <span className="muscles muted" style={{ fontSize: 13 }}>
            {exercise.muscles}
          </span>
        </div>
      </section>

      <section className="stack">
        <h2 className="eyebrow">{hold ? 'Hold for' : 'Target reps'}</h2>
        <div className="chips" role="group" aria-label={hold ? 'Hold duration' : 'Target reps'}>
          {exercise.targetOptions.map((n) => (
            <button key={n} className="chip" aria-pressed={target === n} onClick={() => onTarget(n)}>
              {n === 0 ? 'Open' : hold ? `${n}s` : n}
            </button>
          ))}
        </div>
      </section>

      <section className="card placement">
        <PlacementDiagram view={exercise.camera.recommended} floor={exercise.horizontal} />
        <div className="stack" style={{ gap: 8 }}>
          <h2 className="card-title">Set up your phone</h2>
          <p className="muted">{exercise.camera.placement}</p>
          <p style={{ fontSize: 14 }}>{exercise.camera.why}</p>
        </div>
      </section>

      <section className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <span className="row muted" style={{ gap: 8 }}>
          <IconCamera width={20} height={20} /> Camera
        </span>
        <div className="segmented" role="group" aria-label="Camera">
          <button aria-pressed={facingMode === 'user'} onClick={() => onFacing('user')}>
            Front (selfie)
          </button>
          <button aria-pressed={facingMode === 'environment'} onClick={() => onFacing('environment')}>
            Back
          </button>
        </div>
      </section>

      <details className="tips card">
        <summary>Tips for accurate tracking</summary>
        <ul>
          <li>Keep your whole body in the frame — head to feet{exercise.horizontal ? ', hands to heels' : ''}.</li>
          <li>Good, even light; avoid a bright window behind you.</li>
          <li>Fitted clothes help the camera find your joints.</li>
          <li>When the coach says “hold still”, stay in the start position for a second — it calibrates to your body.</li>
          <li>Turn your volume up: the coach talks to you during the set.</li>
        </ul>
      </details>

      <div className="sticky-actions">
        <button className="btn primary big" onClick={() => start(false)} disabled={starting}>
          <IconPlay /> Start {hold ? 'hold' : 'set'}
        </button>
        {hasDemo(exercise.id) && (
          <button className="btn ghost" onClick={() => start(true)} disabled={starting}>
            Watch a demo (no camera)
          </button>
        )}
      </div>
    </main>
  );
}

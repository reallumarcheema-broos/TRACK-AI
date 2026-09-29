import { useEffect, useMemo, useState } from 'react';
import type { RepResult, SetResult } from '../core/analyzer';
import { fetchDebrief } from '../coach/debrief';
import { describeSet, toDebriefRequest } from '../coach/summary';
import { Priority, type VoiceQueue } from '../coach/voice';
import { previousSets, updateHistory } from '../state/history';
import { ExerciseArt } from './ExerciseArt';
import { IconCoach, IconHistory, IconRepeat, IconSound } from './icons';

export interface SummaryProps {
  result: SetResult;
  entryId: string;
  aiDebrief: boolean;
  voice: VoiceQueue;
  onAgain: () => void;
  onHome: () => void;
  onHistory: () => void;
}

type Debrief = { status: 'loading' } | { status: 'done'; text: string; source: 'claude' | 'local' };

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const toneOfRep = (rep: RepResult) =>
  rep.faults.length === 0 ? 'good' : rep.faults.some((f) => f.severity === 'major') ? 'bad' : 'warn';

export function Summary({ result, entryId, aiDebrief, voice, onAgain, onHome, onHistory }: SummaryProps) {
  const story = useMemo(() => describeSet(result), [result]);
  const [debrief, setDebrief] = useState<Debrief>(aiDebrief ? { status: 'loading' } : { status: 'done', text: story.spoken, source: 'local' });

  useEffect(() => {
    let cancelled = false;
    const say = (text: string) => voice.speak(text, { priority: Priority.urgent, interrupt: true, ttlMs: 20000 });
    if (!aiDebrief) {
      say(story.spoken);
      updateHistory(entryId, { debrief: story.spoken });
      return;
    }
    void fetchDebrief(toDebriefRequest(result, previousSets(result.exerciseId, result.startedAt))).then((res) => {
      if (cancelled) return;
      const text = res?.text ?? story.spoken;
      const source = res?.source ?? 'local';
      setDebrief({ status: 'done', text, source });
      updateHistory(entryId, { debrief: text });
      say(text);
    });
    return () => {
      cancelled = true;
    };
  }, [aiDebrief, entryId, result, story.spoken, voice]);

  const hold = result.kind === 'hold';
  const reps = result.reps.length;
  const holdSec = Math.round(result.holdMs / 1000);
  const timeline = useMemo(
    () => [...result.reps, ...result.partialReps].sort((a, b) => a.window.endT - b.window.endT),
    [result],
  );

  return (
    <main className="page">
      <section className="verdict">
        <ExerciseArt id={result.exerciseId} />
        <span className="eyebrow">{result.exerciseName} · set complete</span>
        <h1>{story.verdict}</h1>
      </section>

      <section className="stats">
        {hold ? (
          <>
            <Stat value={`${holdSec}`} unit={result.target ? `/${result.target}s` : 's'} label="Held" />
            <Stat value={`${result.formScore}`} unit="%" label="Good form" />
            <Stat value={formatDuration(result.durationMs / 1000)} label="Time" />
          </>
        ) : (
          <>
            <Stat value={`${reps}`} unit={result.target ? `/${result.target}` : ''} label="Reps" />
            <Stat value={`${story.cleanReps}`} label="Clean reps" />
            <Stat value={`${result.formScore}`} unit="%" label="Form score" />
          </>
        )}
      </section>

      <section className="card coach-says" aria-live="polite">
        <div className="who">
          <span className="avatar">
            <IconCoach />
          </span>
          <div style={{ flex: 1 }}>
            <strong>Coach</strong>
            {debrief.status === 'done' && debrief.source === 'claude' && (
              <span className="badge good" style={{ marginLeft: 8 }}>
                AI debrief
              </span>
            )}
          </div>
          {debrief.status === 'done' && (
            <button
              className="icon-btn"
              aria-label="Play again"
              onClick={() => voice.speak(debrief.text, { priority: Priority.urgent, interrupt: true, ttlMs: 20000 })}
            >
              <IconSound />
            </button>
          )}
        </div>
        {debrief.status === 'loading' ? (
          <div className="stack" style={{ gap: 8 }} aria-label="Coach is reviewing your set">
            <div className="skeleton-line" />
            <div className="skeleton-line" style={{ width: '85%' }} />
            <div className="skeleton-line" style={{ width: '60%' }} />
          </div>
        ) : (
          <p>{debrief.text}</p>
        )}
      </section>

      {!hold && timeline.length > 0 && (
        <section className="card stack">
          <h2 className="eyebrow">Rep by rep</h2>
          <div className="timeline" role="img" aria-label={timelineLabel(timeline)}>
            {timeline.map((rep, i) => (
              <div
                key={i}
                className={`bar ${rep.counted ? toneOfRep(rep) : 'partial'}`}
                style={{ height: `${rep.counted ? Math.max(18, rep.score) : 30}%` }}
                title={rep.counted ? `Rep ${rep.index}: ${rep.faults.map((f) => f.title).join(', ') || 'clean'}` : `Didn't count: ${rep.faults[0]?.title ?? ''}`}
              />
            ))}
          </div>
          <div className="legend">
            <span>
              <i style={{ background: 'var(--good)' }} />
              Clean
            </span>
            <span>
              <i style={{ background: 'var(--warn)' }} />
              Minor issue
            </span>
            <span>
              <i style={{ background: 'var(--bad)' }} />
              Major issue
            </span>
            <span>
              <i style={{ background: 'var(--border)' }} />
              Didn't count
            </span>
          </div>
        </section>
      )}

      {result.faults.length > 0 && (
        <section className="card stack">
          <h2 className="eyebrow">What to work on</h2>
          <div className="issues">
            {result.faults.slice(0, 4).map(({ cue, count }) => (
              <div className="issue" key={cue.id}>
                <span className={`dot ${cue.severity}`} />
                <div>
                  <strong>{cue.title}</strong>
                  <p>{cue.tip}</p>
                </div>
                <span className="badge">{hold ? `${count}×` : `${count} ${count === 1 ? 'rep' : 'reps'}`}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="sticky-actions">
        <button className="btn primary big" onClick={onAgain}>
          <IconRepeat /> Go again
        </button>
        <div className="row">
          <button className="btn" style={{ flex: 1 }} onClick={onHome}>
            Exercises
          </button>
          <button className="btn" style={{ flex: 1 }} onClick={onHistory}>
            <IconHistory /> History
          </button>
        </div>
      </div>
    </main>
  );
}

function Stat({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <div className="stat">
      <div className="v">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      <div className="k">{label}</div>
    </div>
  );
}

function timelineLabel(reps: RepResult[]): string {
  return reps
    .map((r) => (r.counted ? `Rep ${r.index}: ${r.faults.length ? r.faults.map((f) => f.title).join(', ') : 'clean'}` : 'Attempt that did not count'))
    .join('. ');
}

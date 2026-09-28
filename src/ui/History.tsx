import { useMemo, useState } from 'react';
import { clearHistory, loadHistory, type HistoryEntry } from '../state/history';
import { ExerciseFigure } from './ExerciseFigure';
import { IconBack, IconTrash } from './icons';
import { formatDuration } from './Summary';

function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

const tone = (score: number) => (score >= 80 ? 'good' : score >= 55 ? 'warn' : 'bad');

export function History({ onBack }: { onBack: () => void }) {
  const [entries, setEntries] = useState<HistoryEntry[]>(loadHistory);
  const groups = useMemo(() => {
    const map = new Map<string, HistoryEntry[]>();
    for (const e of entries) {
      const k = dayLabel(e.startedAt);
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return [...map.entries()];
  }, [entries]);
  const week = entries.filter((e) => !e.demo && Date.now() - e.startedAt < 7 * 86_400_000);
  const weekReps = week.reduce((s, e) => s + (e.kind === 'reps' ? e.reps : 0), 0);

  return (
    <main className="page">
      <header className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <IconBack />
        </button>
        <h1 style={{ fontSize: 22 }}>History</h1>
        <span className="spacer" />
        {entries.length > 0 && (
          <button
            className="icon-btn"
            aria-label="Clear history"
            onClick={() => {
              if (confirm('Delete all saved sets from this device?')) {
                clearHistory();
                setEntries([]);
              }
            }}
          >
            <IconTrash />
          </button>
        )}
      </header>

      {entries.length === 0 ? (
        <p className="empty">No sets yet. Finish a set and it will show up here.</p>
      ) : (
        <>
          <section className="stats">
            <div className="stat">
              <div className="v">{week.length}</div>
              <div className="k">Sets this week</div>
            </div>
            <div className="stat">
              <div className="v">{weekReps}</div>
              <div className="k">Reps this week</div>
            </div>
            <div className="stat">
              <div className="v">
                {week.length ? Math.round(week.reduce((s, e) => s + e.formScore, 0) / week.length) : 0}
                <small>%</small>
              </div>
              <div className="k">Avg form</div>
            </div>
          </section>
          {groups.map(([label, list]) => (
            <section key={label} className="stack" style={{ gap: 8 }}>
              <h2 className="group-title">{label}</h2>
              <div className="list">
                {list.map((e) => (
                  <article key={e.id} className="list-item">
                    <ExerciseFigure id={e.exerciseId} className="figure" />
                    <div>
                      <div className="title">
                        {e.exerciseName} {e.demo && <span className="badge">demo</span>}
                      </div>
                      <div className="meta">
                        {e.kind === 'hold' ? `${e.holdSec ?? 0}s hold` : `${e.reps}${e.target ? `/${e.target}` : ''} reps`}
                        {' · '}
                        {formatDuration(e.durationSec)}
                        {e.topFaults[0] ? ` · ${e.topFaults[0].title.toLowerCase()}` : ' · clean'}
                      </div>
                    </div>
                    <span className={`score-pill ${tone(e.formScore)}`} aria-label={`Form score ${e.formScore}%`}>
                      {e.formScore}%
                    </span>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </main>
  );
}

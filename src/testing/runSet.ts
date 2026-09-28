/** Test helper: runs a simulated set through the analyzer and collects the outcome. */
import { WorkoutAnalyzer, type AnalyzerEvent, type AnalyzerOptions } from '../core/analyzer';
import { EXERCISE_BY_ID } from '../exercises';
import { simulate, type SimOptions } from '../sim/simulator';

export interface SetOutcome {
  analyzer: WorkoutAnalyzer;
  events: { t: number; e: AnalyzerEvent }[];
  /** Fault ids per counted rep, in order. */
  repFaults: string[][];
  /** Fault ids per partial (uncounted) rep. */
  partialFaults: string[][];
  views: Set<string>;
}

export function runSet(opts: SimOptions, analyzerOpts: Partial<AnalyzerOptions> = {}): SetOutcome {
  const analyzer = new WorkoutAnalyzer(EXERCISE_BY_ID[opts.exercise], analyzerOpts);
  const events: { t: number; e: AnalyzerEvent }[] = [];
  const views = new Set<string>();
  for (const frame of simulate(opts)) {
    const out = analyzer.process(frame.pose, frame.t, frame.aspect);
    if (out.snapshot.view && analyzer.status === 'active') views.add(out.snapshot.view);
    for (const e of out.events) events.push({ t: frame.t, e });
  }
  return {
    analyzer,
    events,
    repFaults: analyzer.reps.map((r) => r.faults.map((f) => f.id).sort()),
    partialFaults: analyzer.partialReps.map((r) => r.faults.map((f) => f.id).sort()),
    views,
  };
}

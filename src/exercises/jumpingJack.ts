import type { ExerciseDef } from '../core/exercise';
import { ankleSpread, requiredFullBody } from './helpers';

const armRaise = (f: Parameters<ExerciseDef['required']>[0]): number | null =>
  f.bySide((s) => f.armRaiseAngle(s, f.spaceFor('frontal')), ['shoulder', 'wrist', 'hip']);

export const jumpingJack: ExerciseDef = {
  id: 'jumping_jack',
  name: 'Jumping Jacks',
  tagline: 'Full-body cardio warm-up',
  muscles: 'Full body · Cardio',
  kind: 'reps',
  camera: {
    recommended: 'front',
    allowed: ['front', 'diagonal'],
    placement: 'Prop your phone 2.5–3 m away facing you, with room for your arms overhead and feet out wide.',
    why: 'Facing me I can see your arms go overhead and your feet jump wide.',
  },
  required: requiredFullBody,
  startPosition: (f) => {
    const a = armRaise(f);
    if (a === null) return 'Face the camera with your arms in view';
    return a > 50 ? 'Stand tall with your arms by your sides' : null;
  },
  calibrate: {
    spread: (f) => ankleSpread(f),
  },
  trackers: {
    spread: (f) => ankleSpread(f),
  },
  rep: {
    direction: 'up',
    metric: (f) => armRaise(f),
    start: 20,
    target: 135,
    ideal: 150,
    startTolerance: 15,
    counter: { minRepMs: 250, partialMin: 0.5 },
    shallow: {
      id: 'jj_arms',
      title: 'Arms not overhead',
      cues: ['Hands all the way up!', "Arms overhead — that one didn't count"],
      severity: 'major',
      tip: 'Bring your hands all the way overhead on every jack.',
    },
    depth: {
      id: 'jj_arms_high',
      title: 'Arms a bit low',
      cues: ['Reach higher', 'Hands up high'],
      severity: 'minor',
      tip: 'Reach your hands right up over your head.',
    },
  },
  repRules: [
    {
      id: 'jj_feet',
      title: 'Feet not wide',
      cues: ['Jump your feet wider', 'Feet out wide!'],
      severity: 'minor',
      tip: 'Jump your feet out wider than your shoulders.',
      check: (rep, cal) => {
        const agg = rep.agg.spread;
        if (!agg) return false;
        const base = Number.isFinite(cal.base.spread) ? cal.base.spread : 1;
        return agg.max < Math.max(1.8, base * 1.6);
      },
    },
  ],
  rules: [],
  praise: ['Nice!', 'Keep it up!', 'Good pace!', "That's it!"],
  defaultTarget: 20,
  targetOptions: [10, 20, 30, 50, 0],
};

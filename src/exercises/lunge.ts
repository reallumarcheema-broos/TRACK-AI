import type { ExerciseDef } from '../core/exercise';
import { LM } from '../core/landmarks';
import { kneeCollapse, legsStraight, maxThighInclination, requiredFullBody, thighInclination, torsoLean } from './helpers';

export const lunge: ExerciseDef = {
  id: 'lunge',
  name: 'Lunge',
  repNoun: 'lunges',
  tagline: 'Forward, reverse or split-squat lunges',
  muscles: 'Quads · Glutes · Balance',
  kind: 'reps',
  camera: {
    recommended: 'side',
    allowed: ['side', 'front', 'diagonal'],
    placement: 'Prop your phone at hip height, 2–3 m away, with room to step forward or back in view.',
    why: 'Side-on I can judge depth and torso position. Facing me I can watch your front knee.',
  },
  required: requiredFullBody,
  startPosition: (f, ctx) => {
    const thigh = maxThighInclination(f, ctx.cal);
    const straight = legsStraight(f);
    if (thigh === null || straight === null) return 'Stand tall so I can see both legs';
    return thigh > 25 || !straight ? 'Stand tall to begin' : null;
  },
  calibrate: {
    lean: (f, cal) => torsoLean(f, cal),
  },
  rep: {
    direction: 'down',
    // The front thigh drops toward parallel; the back thigh stays near vertical.
    metric: (f, ctx) => maxThighInclination(f, ctx.cal),
    start: 3,
    target: 58,
    ideal: 72,
    startTolerance: 12,
    shallow: {
      id: 'lunge_shallow',
      title: 'Too shallow',
      cues: ["Drop your back knee lower — that one didn't count", 'Lower, back knee toward the floor'],
      severity: 'major',
      tip: 'Lower until your back knee nearly touches the floor so the rep counts.',
    },
    depth: {
      id: 'lunge_depth',
      title: 'Could go deeper',
      cues: ['A little lower', 'Back knee closer to the floor'],
      severity: 'minor',
      tip: 'Aim for both knees at about 90 degrees at the bottom.',
    },
    tempo: {
      minGoingMs: 450,
      cue: {
        id: 'lunge_fast',
        title: 'Rushing',
        cues: ['Slow it down', 'Control the way down'],
        severity: 'minor',
        tip: 'Lower with control — no dropping into the bottom.',
      },
    },
  },
  rules: [
    {
      id: 'torso_lean',
      title: 'Leaning forward',
      cues: ['Stay tall through your chest', 'Keep your torso upright', 'Chest up'],
      severity: 'minor',
      tip: 'Keep your torso tall and stacked over your hips.',
      views: ['side', 'diagonal'],
      minProgress: 0.5,
      persistMs: 300,
      joints: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP],
      check: (f, ctx) => {
        const lean = torsoLean(f, ctx.cal);
        if (!Number.isFinite(lean)) return null;
        const base = Number.isFinite(ctx.cal.base.lean) ? ctx.cal.base.lean : 0;
        return lean - base > 30;
      },
    },
    {
      id: 'front_knee_caving',
      title: 'Knee caving in',
      cues: ['Keep your front knee over your toes', "Don't let your knee cave in", 'Knee out, in line with your foot'],
      severity: 'major',
      tip: 'Keep your front knee in line with your second toe — no collapsing inward.',
      // At an angle, forward knee travel projects sideways and looks like collapse.
      views: ['front'],
      minProgress: 0.45,
      persistMs: 200,
      joints: [LM.LEFT_KNEE, LM.RIGHT_KNEE],
      check: (f, ctx) => {
        const values: number[] = [];
        for (const side of ['left', 'right'] as const) {
          const thigh = thighInclination(f, ctx.cal, side);
          if (thigh === null || thigh < 35) continue; // only the bending (front) leg
          const c = kneeCollapse(f, side);
          if (c !== null) values.push(c);
        }
        return values.length ? Math.max(...values) > 0.18 : null;
      },
    },
  ],
  praise: ['Great lunge!', 'Nice and deep!', 'Solid!', 'Good balance!', 'Strong rep!'],
  defaultTarget: 10,
  targetOptions: [6, 8, 10, 12, 16, 20, 0],
};

import type { ExerciseDef } from '../core/exercise';
import { LM, SIDE } from '../core/landmarks';
import { dist } from '../core/vec';
import { avgPressHeight, pressHeight, requiredUpperBody, straightness, torsoLean } from './helpers';

export const press: ExerciseDef = {
  id: 'press',
  name: 'Shoulder Press',
  tagline: 'Standing dumbbell or barbell overhead press',
  muscles: 'Shoulders · Triceps · Core',
  kind: 'reps',
  camera: {
    recommended: 'front',
    allowed: ['front', 'diagonal', 'side'],
    placement: 'Prop your phone at chest height, 2–3 m away, with room above your head for your hands.',
    why: 'Facing me I can compare both arms; side-on I can spot you leaning back.',
  },
  required: requiredUpperBody,
  startPosition: (f, ctx) => {
    const h = avgPressHeight(f, ctx.cal);
    if (h === null) return 'Keep your arms in view';
    let bent = false;
    for (const side of ['left', 'right'] as const) {
      if (f.sideVisible(side, ['shoulder', 'elbow', 'wrist']) && f.elbowAngle(side, f.spaceFor('frontal')) < 125) bent = true;
    }
    return h > -0.35 && h < 0.65 && bent ? null : 'Bring your hands up to your shoulders to begin';
  },
  calibrate: {
    lean: (f, cal) => torsoLean(f, cal),
    torso2d: (f) => {
      const s = f.mid(LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, 'image');
      const h = f.mid(LM.LEFT_HIP, LM.RIGHT_HIP, 'image');
      return f.view === 'side' ? dist(f.img[SIDE[f.near].shoulder], f.img[SIDE[f.near].hip]) : dist(s, h);
    },
  },
  trackers: {
    // Lockout: a straight arm looks straight in any projection, so this tolerates 3D depth error.
    elbow: (f) => f.bySide((s) => straightness(f, SIDE[s].shoulder, SIDE[s].elbow, SIDE[s].wrist), ['shoulder', 'elbow', 'wrist']),
  },
  rep: {
    direction: 'up',
    metric: (f, ctx) => avgPressHeight(f, ctx.cal),
    start: 0.1,
    target: 0.9,
    // Rack height varies a lot (dumbbells at the chin vs. the ears, camera angle).
    startTolerance: 0.5,
    counter: { partialMin: 0.5 },
    shallow: {
      id: 'press_shallow',
      title: 'Partial press',
      cues: ["Press all the way up — that one didn't count", 'All the way overhead'],
      severity: 'major',
      tip: 'Press until your arms are straight overhead, biceps by your ears.',
    },
  },
  repRules: [
    {
      id: 'press_lockout',
      title: 'Soft lockout',
      cues: ['Lock out your elbows at the top', 'Straighten your arms overhead'],
      severity: 'minor',
      tip: 'Finish every rep with straight arms directly over your shoulders.',
      check: (rep) => (rep.agg.elbow ? rep.agg.elbow.max < 152 : false),
    },
  ],
  rules: [
    {
      id: 'lean_back',
      title: 'Leaning back',
      cues: ["Don't lean back — squeeze your glutes", 'Ribs down, brace your core', 'Stay stacked, no leaning back'],
      severity: 'major',
      tip: 'Squeeze your glutes and brace your abs so your lower back doesn’t arch.',
      views: ['side', 'diagonal'],
      persistMs: 250,
      joints: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP],
      check: (f, ctx) => {
        const lean = torsoLean(f, ctx.cal);
        if (!Number.isFinite(lean)) return null;
        // Relative to the athlete's own standing posture.
        const base = Number.isFinite(ctx.cal.base.lean) ? ctx.cal.base.lean : 0;
        return lean - base > 14;
      },
    },
    {
      id: 'uneven_press',
      title: 'Uneven arms',
      cues: ['Press evenly with both arms', 'Keep both hands level'],
      severity: 'minor',
      tip: 'Drive both arms up at the same speed; your weaker side sets the pace.',
      views: ['front'],
      minProgress: 0.3,
      persistMs: 250,
      joints: [LM.LEFT_WRIST, LM.RIGHT_WRIST],
      check: (f, ctx) => {
        const l = pressHeight(f, ctx.cal, 'left');
        const r = pressHeight(f, ctx.cal, 'right');
        if (l === null || r === null) return null;
        // ~11 cm between the wrists for an average torso.
        return Math.abs(l - r) > 0.22;
      },
    },
  ],
  praise: ['Great press!', 'Nice lockout!', 'Strong!', 'Solid rep!', 'Perfect!'],
  defaultTarget: 10,
  targetOptions: [5, 8, 10, 12, 15, 0],
};

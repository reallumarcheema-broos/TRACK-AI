import type { ExerciseDef } from '../core/exercise';
import { LM } from '../core/landmarks';
import { hipAngle, hipTravel, kneeAngle, neckFlexion, requiredFullBody, torsoChord } from './helpers';

export const rdl: ExerciseDef = {
  id: 'rdl',
  name: 'Romanian Deadlift',
  tagline: 'Hip hinge with dumbbells, kettlebell or bar',
  muscles: 'Hamstrings · Glutes · Back',
  kind: 'reps',
  camera: {
    recommended: 'side',
    allowed: ['side', 'diagonal'],
    placement: 'Place your phone at hip height, 2–3 m to your side, whole body in view.',
    why: 'Side-on is the only way I can see your hip hinge and whether your back stays flat.',
  },
  required: requiredFullBody,
  startPosition: (f) => {
    const h = hipAngle(f);
    const k = kneeAngle(f);
    if (h === null || k === null) return 'Stand side-on so I can see your hips and knees';
    return h < 155 || k < 145 ? 'Stand tall to begin' : null;
  },
  calibrate: {
    neck: (f) => neckFlexion(f),
    chord: (f) => torsoChord(f),
    hip: (f) => hipTravel(f),
  },
  trackers: {
    hipTravel: (f) => hipTravel(f),
    knee: (f) => kneeAngle(f),
  },
  rep: {
    metric: (f) => hipAngle(f),
    start: 170,
    target: 125,
    ideal: 110,
    startTolerance: 12,
    shallow: {
      id: 'rdl_shallow',
      title: 'Not hinging far enough',
      cues: ["Hinge further — that one didn't count", 'Push your hips back further'],
      severity: 'major',
      tip: 'Hinge until you feel a stretch in your hamstrings, weights around knee height or lower.',
    },
    depth: {
      id: 'rdl_depth',
      title: 'Short range',
      cues: ['A little deeper — feel the hamstrings', 'Hinge a bit further'],
      severity: 'minor',
      tip: 'Hinge a little further while keeping your back flat.',
    },
    lockout: {
      id: 'rdl_lockout',
      title: 'Not finishing tall',
      cues: ['Squeeze your glutes and stand tall', 'Finish tall at the top'],
      severity: 'minor',
      tip: 'Drive your hips through and stand fully upright at the top of each rep.',
    },
    tempo: {
      minGoingMs: 700,
      cue: {
        id: 'rdl_fast',
        title: 'Lowering too fast',
        cues: ['Slow down on the way down', 'Control the lowering'],
        severity: 'minor',
        tip: 'Take two seconds to lower — the stretch is where the work happens.',
      },
    },
  },
  repRules: [
    {
      id: 'hips_not_back',
      title: 'Hips not going back',
      cues: ['Push your hips back', 'Hips back, like closing a car door with your butt'],
      severity: 'minor',
      tip: 'Start the movement by pushing your hips backward, not by bending forward.',
      check: (rep, cal) => {
        const agg = rep.agg.hipTravel;
        if (!agg) return false;
        const base = Number.isFinite(cal.base.hip) ? cal.base.hip : 0;
        return agg.min - base > -0.08;
      },
    },
  ],
  rules: [
    {
      id: 'back_rounding',
      title: 'Back rounding',
      cues: ['Flat back!', "Don't round your back — chest proud", 'Keep your spine neutral'],
      severity: 'major',
      tip: 'Keep your chest proud and shoulders back; only hinge as far as you can with a flat back.',
      views: ['side', 'diagonal'],
      minProgress: 0.35,
      persistMs: 250,
      joints: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_EAR, LM.RIGHT_EAR],
      check: (f, ctx) => {
        const neck = neckFlexion(f);
        const chord = torsoChord(f);
        if (neck === null && chord === null) return null;
        const baseNeck = ctx.cal.base.neck;
        const baseChord = ctx.cal.base.chord;
        const neckBad = neck !== null && neck > 40 && (!Number.isFinite(baseNeck) || neck - baseNeck > 25);
        const chordBad = chord !== null && Number.isFinite(baseChord) && chord / baseChord < 0.82;
        return neckBad || chordBad;
      },
    },
    {
      id: 'knees_too_bent',
      title: 'Squatting it',
      cues: ['Keep your legs straighter — soft knees', 'Less knee bend, push your hips back'],
      severity: 'minor',
      tip: 'Keep a soft, fixed bend in your knees; the movement comes from your hips.',
      views: ['side', 'diagonal'],
      minProgress: 0.5,
      persistMs: 300,
      joints: [LM.LEFT_KNEE, LM.RIGHT_KNEE],
      check: (f) => {
        const k = kneeAngle(f);
        return k === null ? null : k < 132;
      },
    },
  ],
  praise: ['Great hinge!', 'Nice flat back!', 'Solid rep!', 'Good stretch!', 'Strong!'],
  defaultTarget: 10,
  targetOptions: [5, 8, 10, 12, 15, 0],
};

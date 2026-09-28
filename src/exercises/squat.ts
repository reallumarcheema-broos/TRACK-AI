import type { ExerciseDef } from '../core/exercise';
import { LM } from '../core/landmarks';
import {
  footPitch,
  kneeAngle,
  kneeAnkleRatio,
  neckFlexion,
  requiredFullBody,
  shinAngle,
  thighAngle,
  torsoChord,
  torsoLean,
} from './helpers';

export const squat: ExerciseDef = {
  id: 'squat',
  name: 'Squat',
  tagline: 'Bodyweight, goblet or barbell squats',
  muscles: 'Quads · Glutes · Core',
  kind: 'reps',
  camera: {
    recommended: 'side',
    allowed: ['side', 'front', 'diagonal'],
    placement: 'Prop your phone at about hip height, 2–3 m away, so your whole body is in the frame.',
    why: 'Side-on I can judge depth, back angle and heels. Facing the camera I can check your knees.',
  },
  required: requiredFullBody,
  startPosition: (f) => {
    const k = kneeAngle(f);
    if (k === null) return 'Stand tall so I can see your legs';
    return k < 150 ? 'Stand up tall to begin' : null;
  },
  calibrate: {
    neck: (f) => (f.view === 'side' ? neckFlexion(f) : null),
    chord: (f) => (f.view === 'side' ? torsoChord(f) : null),
    foot: (f) => (f.view === 'side' ? footPitch(f) : null),
    kneeRatio: (f) => (f.view !== 'side' ? kneeAnkleRatio(f) : null),
    hipOffset: (f) => {
      if (f.view === 'side') return null;
      const hipMid = f.mid(LM.LEFT_HIP, LM.RIGHT_HIP, 'image');
      const ankleMid = f.mid(LM.LEFT_ANKLE, LM.RIGHT_ANKLE, 'image');
      const hipW = Math.abs(f.img[LM.LEFT_HIP].x - f.img[LM.RIGHT_HIP].x);
      return hipW > 1e-4 ? (hipMid.x - ankleMid.x) / hipW : null;
    },
  },
  trackers: {
    thigh: (f, ctx) => thighAngle(f, ctx.cal),
  },
  rep: {
    metric: (f) => kneeAngle(f),
    start: 170,
    target: 110,
    startTolerance: 12,
    shallow: {
      id: 'squat_shallow',
      title: 'Too shallow',
      cues: ["Deeper — that one didn't count", 'Sit lower, hips down', 'Go deeper on the next one'],
      severity: 'major',
      tip: 'Squat until your thighs are at least near parallel so the rep counts.',
    },
    lockout: {
      id: 'squat_lockout',
      title: 'Not standing tall',
      cues: ['Stand all the way up between reps', 'Finish tall at the top', 'Lock it out at the top'],
      severity: 'minor',
      tip: 'Finish each rep standing fully upright with hips and knees extended.',
    },
    tempo: {
      minGoingMs: 550,
      cue: {
        id: 'squat_fast',
        title: 'Dropping too fast',
        cues: ['Slow down on the way down', 'Control the descent', 'Nice and slow going down'],
        severity: 'minor',
        tip: 'Take about a second or two on the way down to stay in control.',
      },
    },
  },
  repRules: [
    {
      id: 'squat_depth',
      title: 'Above parallel',
      cues: ['A little deeper — thighs to parallel', 'Sink a bit lower next rep'],
      severity: 'minor',
      tip: 'Aim to get your thighs parallel to the floor at the bottom.',
      check: (rep) => (rep.agg.thigh ? rep.agg.thigh.max < 72 : false),
    },
  ],
  rules: [
    {
      id: 'knees_caving',
      title: 'Knees caving in',
      cues: ['Push your knees out', 'Knees out over your toes', "Don't let your knees cave in"],
      severity: 'major',
      tip: 'Keep your knees tracking over your toes — push them out as you squat.',
      views: ['front', 'diagonal'],
      minProgress: 0.45,
      persistMs: 200,
      joints: [LM.LEFT_KNEE, LM.RIGHT_KNEE],
      check: (f, ctx) => {
        const r = kneeAnkleRatio(f);
        if (r === null) return null;
        const base = ctx.cal.base.kneeRatio;
        const limit = Number.isFinite(base) ? Math.min(0.8, base - 0.12) : 0.8;
        return r < limit;
      },
    },
    {
      id: 'back_rounding',
      title: 'Back rounding',
      cues: ['Keep your back flat', 'Chest proud, flat back', "Don't round your back"],
      severity: 'major',
      tip: 'Brace your core and keep your chest up so your spine stays neutral.',
      views: ['side'],
      minProgress: 0.4,
      persistMs: 250,
      joints: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_EAR, LM.RIGHT_EAR],
      check: (f, ctx) => {
        const neck = neckFlexion(f);
        const chord = torsoChord(f);
        if (neck === null && chord === null) return null;
        const baseNeck = ctx.cal.base.neck;
        const baseChord = ctx.cal.base.chord;
        const neckBad = neck !== null && neck > 45 && (!Number.isFinite(baseNeck) || neck - baseNeck > 28);
        const chordBad = chord !== null && Number.isFinite(baseChord) && chord / baseChord < 0.8;
        return neckBad || chordBad;
      },
    },
    {
      id: 'chest_forward',
      title: 'Chest dropping',
      cues: ['Chest up', 'Keep your chest up', 'Lift your chest, sit back'],
      severity: 'minor',
      tip: 'Keep your torso more upright — roughly parallel to your shins at the bottom.',
      views: ['side'],
      minProgress: 0.5,
      persistMs: 300,
      joints: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP],
      check: (f, ctx) => {
        const lean = torsoLean(f, ctx.cal);
        const shin = shinAngle(f, ctx.cal);
        if (!Number.isFinite(lean)) return null;
        return lean > 60 || (shin !== null && lean > 45 && lean - shin > 25);
      },
    },
    {
      id: 'heels_rising',
      title: 'Heels lifting',
      cues: ['Keep your heels down', 'Drive through your heels', 'Weight in your heels'],
      severity: 'minor',
      tip: 'Keep your whole foot planted; sit your hips back and push through your heels.',
      views: ['side'],
      minProgress: 0.4,
      persistMs: 250,
      joints: [LM.LEFT_HEEL, LM.RIGHT_HEEL],
      check: (f, ctx) => {
        const p = footPitch(f);
        if (p === null) return null;
        const base = Number.isFinite(ctx.cal.base.foot) ? ctx.cal.base.foot : 0;
        return p - base > 14;
      },
    },
    {
      id: 'hip_shift',
      title: 'Shifting to one side',
      cues: ['Keep your weight centered', 'Stay even on both feet'],
      severity: 'minor',
      tip: 'Keep your hips centered between your feet as you squat.',
      views: ['front'],
      minProgress: 0.5,
      persistMs: 350,
      joints: [LM.LEFT_HIP, LM.RIGHT_HIP],
      check: (f, ctx) => {
        const need = [LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_ANKLE, LM.RIGHT_ANKLE];
        if (!f.allVisible(need)) return null;
        const hipMid = f.mid(LM.LEFT_HIP, LM.RIGHT_HIP, 'image');
        const ankleMid = f.mid(LM.LEFT_ANKLE, LM.RIGHT_ANKLE, 'image');
        const hipW = Math.abs(f.img[LM.LEFT_HIP].x - f.img[LM.RIGHT_HIP].x);
        if (hipW < 1e-4) return null;
        const base = Number.isFinite(ctx.cal.base.hipOffset) ? ctx.cal.base.hipOffset : 0;
        return Math.abs((hipMid.x - ankleMid.x) / hipW - base) > 0.45;
      },
    },
  ],
  praise: ['Great depth!', 'Nice squat!', 'Strong rep!', "That's it!", 'Perfect form!', 'Smooth!'],
  defaultTarget: 10,
  targetOptions: [5, 8, 10, 12, 15, 20, 0],
};


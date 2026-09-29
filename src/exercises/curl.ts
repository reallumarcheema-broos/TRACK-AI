import type { ExerciseDef } from '../core/exercise';
import { LM } from '../core/landmarks';
import { curlElbowAngle, requiredUpperBody, torsoLean, upperArmInclination } from './helpers';

export const curl: ExerciseDef = {
  id: 'curl',
  name: 'Bicep Curl',
  repNoun: 'curls',
  tagline: 'Dumbbell curls — together or alternating',
  muscles: 'Biceps · Forearms',
  kind: 'reps',
  camera: {
    recommended: 'front',
    allowed: ['front', 'diagonal', 'side'],
    placement: 'Prop your phone at chest height, 1.5–2.5 m away, from your head to your hips in view.',
    why: 'Facing me I can watch both arms and check that your elbows stay pinned.',
  },
  required: requiredUpperBody,
  calibrate: {
    lean: (f, cal) => torsoLean(f, cal),
  },
  startPosition: (f, ctx) => {
    const extended = (['left', 'right'] as const).some((side) => (curlElbowAngle(f, ctx.cal, side) ?? 0) > 135);
    return extended ? null : 'Let your arms hang straight to begin';
  },
  rep: {
    direction: 'up',
    metric: () => null,
    perSide: (f, side, ctx) => {
      // Side-on, the far arm is hidden behind the body; only trust the near one.
      if (f.view === 'side' && side !== f.near) return null;
      return curlElbowAngle(f, ctx.cal, side);
    },
    start: 160,
    target: 70,
    ideal: 55,
    startTolerance: 15,
    counter: { partialMin: 0.5 },
    shallow: {
      id: 'curl_shallow',
      title: 'Half rep',
      cues: ["Curl all the way up — that one didn't count", 'All the way up, squeeze at the top'],
      severity: 'major',
      tip: 'Curl until your forearm is close to your upper arm, then squeeze.',
    },
    depth: {
      id: 'curl_depth',
      title: 'Short at the top',
      cues: ['Squeeze all the way up', 'A little higher at the top'],
      severity: 'minor',
      tip: 'Finish each curl with a full squeeze at the top.',
    },
    lockout: {
      id: 'curl_extension',
      title: 'Not extending fully',
      cues: ['Straighten your arms fully at the bottom', 'All the way down'],
      severity: 'minor',
      tip: 'Lower until your arms are straight to work the full range.',
    },
    tempo: {
      minReturningMs: 450,
      cue: {
        id: 'curl_fast',
        title: 'Dropping the weight',
        cues: ['Lower the weight slowly', 'Control it on the way down'],
        severity: 'minor',
        tip: 'Take a full second or two to lower — don’t let gravity do the work.',
      },
    },
  },
  rules: [
    {
      id: 'elbow_drift',
      title: 'Elbows drifting',
      cues: ['Keep your elbows pinned to your sides', 'Elbows still', 'Lock your elbows at your sides'],
      severity: 'minor',
      tip: 'Keep your upper arms still and elbows by your ribs — only your forearms move.',
      minProgress: 0.35,
      persistMs: 300,
      joints: [LM.LEFT_ELBOW, LM.RIGHT_ELBOW],
      check: (f, ctx) => {
        let worst: number | null = null;
        for (const side of ['left', 'right'] as const) {
          if (f.view === 'side' && side !== f.near) continue;
          // Only the arm that is actually curling.
          const elbow = curlElbowAngle(f, ctx.cal, side);
          if (elbow === null || elbow > 130) continue;
          const a = upperArmInclination(f, ctx.cal, side);
          if (a !== null) worst = worst === null ? a : Math.max(worst, a);
        }
        return worst === null ? null : worst > 38;
      },
    },
    {
      id: 'body_swing',
      title: 'Swinging',
      cues: ["Don't swing — keep your body still", 'No swinging, stay tall', 'Use your arms, not your back'],
      severity: 'major',
      tip: 'Brace your core and keep your torso still; lower the weight if you need momentum.',
      persistMs: 200,
      joints: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP],
      check: (f, ctx) => {
        const lean = torsoLean(f, ctx.cal);
        if (!Number.isFinite(lean)) return null;
        // Change from the athlete's calibrated rest posture (cancels any fixed 3D bias).
        const base = Number.isFinite(ctx.cal.base.lean) ? ctx.cal.base.lean : 0;
        return lean - base > (f.angleSpace === 'image' ? 12 : 15);
      },
    },
  ],
  praise: ['Great curl!', 'Nice squeeze!', 'Strict rep!', 'Good control!', 'Perfect!'],
  defaultTarget: 12,
  targetOptions: [8, 10, 12, 15, 20, 0],
};

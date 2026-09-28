import type { ExerciseDef } from '../core/exercise';
import { LM, SIDE } from '../core/landmarks';
import { bodyInclination, bodyLineSag, headDrop, requiredFloor } from './helpers';

function inPlank(f: Parameters<ExerciseDef['required']>[0]): boolean {
  const incline = bodyInclination(f);
  if (incline === null || incline > 35) return false;
  const j = SIDE[f.near];
  if (!f.visible(j.shoulder, 0.4) || !f.visible(j.elbow, 0.4)) return false;
  // Supported on the arms: elbows (forearm plank) or hands below the shoulders.
  const armsUnder = f.img[j.elbow].y > f.img[j.shoulder].y;
  const legsStraight = !f.visible(j.knee, 0.4) || !f.visible(j.ankle, 0.4) || f.kneeAngle(f.near, 'image') > 140;
  return armsUnder && legsStraight;
}

export const plank: ExerciseDef = {
  id: 'plank',
  name: 'Plank',
  tagline: 'Forearm or high plank hold',
  muscles: 'Core · Shoulders · Glutes',
  kind: 'hold',
  horizontal: true,
  camera: {
    recommended: 'side',
    allowed: ['side', 'diagonal'],
    placement: 'Put your phone on the floor, 2 m to your side, ideally in landscape — head to heels in the frame.',
    why: 'Side-on I can see if your hips sag or pike.',
  },
  required: requiredFloor,
  startPosition: (f) => (inPlank(f) ? null : 'Get into your plank, side-on to the camera'),
  hold: {
    inPosition: (f) => inPlank(f),
    lostCues: ['Get back into your plank', 'Back into position — you’ve got this'],
  },
  rules: [
    {
      id: 'hips_sagging',
      title: 'Hips sagging',
      cues: ['Lift your hips — squeeze your glutes', 'Hips up, core tight', "Don't let your hips sag"],
      severity: 'major',
      tip: 'Squeeze your glutes and pull your belly button in to keep a straight line.',
      persistMs: 500,
      joints: [LM.LEFT_HIP, LM.RIGHT_HIP],
      check: (f) => {
        const sag = bodyLineSag(f);
        return sag === null ? null : sag > 0.06;
      },
    },
    {
      id: 'hips_piking',
      title: 'Hips too high',
      cues: ['Lower your hips into a straight line', 'Hips down a little'],
      severity: 'minor',
      tip: 'Lower your hips until shoulders, hips and heels line up.',
      persistMs: 600,
      joints: [LM.LEFT_HIP, LM.RIGHT_HIP],
      check: (f) => {
        const sag = bodyLineSag(f);
        return sag === null ? null : sag < -0.09;
      },
    },
    {
      id: 'head_dropping',
      title: 'Head dropping',
      cues: ['Keep your neck neutral — eyes to the floor', "Don't drop your head"],
      severity: 'minor',
      tip: 'Look at the floor just in front of your hands and keep your head in line with your spine.',
      persistMs: 600,
      joints: [LM.NOSE, LM.LEFT_EAR, LM.RIGHT_EAR],
      check: (f) => {
        const d = headDrop(f);
        return d === null ? null : d > 0.22;
      },
    },
  ],
  praise: ['Strong hold!', 'Solid plank!', 'Rock solid!'],
  defaultTarget: 30,
  targetOptions: [20, 30, 45, 60, 90, 120, 0],
};

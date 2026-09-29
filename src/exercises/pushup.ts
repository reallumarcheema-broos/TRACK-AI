import type { ExerciseDef } from '../core/exercise';
import { LM } from '../core/landmarks';
import { bodyInclination, bodyLineSag, elbowAngle, headDrop, requiredFloor } from './helpers';

export const pushup: ExerciseDef = {
  id: 'pushup',
  name: 'Push-up',
  repNoun: 'push-ups',
  tagline: 'Full or knee push-ups',
  muscles: 'Chest · Triceps · Shoulders · Core',
  kind: 'reps',
  horizontal: true,
  camera: {
    recommended: 'side',
    allowed: ['side'],
    placement: 'Put your phone on the floor, 2 m to your side, in landscape if you can — head to heels in the frame.',
    why: 'Side-on I can see your body line (hip sag) and how low your chest goes.',
  },
  required: requiredFloor,
  startPosition: (f) => {
    const incline = bodyInclination(f);
    if (incline === null) return 'Get into a push-up position, side-on to the camera';
    if (incline > 45) return 'Get down into a high plank to begin';
    const e = elbowAngle(f);
    if (e !== null && e < 145) return 'Straighten your arms at the top to begin';
    return null;
  },
  rep: {
    direction: 'down',
    metric: (f) => elbowAngle(f),
    start: 165,
    target: 105,
    ideal: 90,
    startTolerance: 12,
    shallow: {
      id: 'pushup_shallow',
      title: 'Too shallow',
      cues: ["Lower — that one didn't count", 'Chest closer to the floor', 'Go all the way down'],
      severity: 'major',
      tip: 'Lower until your elbows reach about 90 degrees so the rep counts.',
    },
    depth: {
      id: 'pushup_depth',
      title: 'Not quite low enough',
      cues: ['A little lower', 'Get your chest closer to the floor'],
      severity: 'minor',
      tip: 'Bring your chest to about a fist from the floor on every rep.',
    },
    lockout: {
      id: 'pushup_lockout',
      title: 'Not locking out',
      cues: ['Push all the way up', 'Straighten your arms at the top'],
      severity: 'minor',
      tip: 'Press all the way up until your arms are straight between reps.',
    },
    tempo: {
      minGoingMs: 450,
      cue: {
        id: 'pushup_fast',
        title: 'Dropping too fast',
        cues: ['Control the way down', 'Slower on the way down'],
        severity: 'minor',
        tip: 'Lower yourself under control instead of dropping.',
      },
    },
  },
  rules: [
    {
      id: 'hips_sagging',
      title: 'Hips sagging',
      cues: ["Tighten your core — don't let your hips sag", 'Squeeze your glutes, hips up', 'Keep a straight line, core tight'],
      severity: 'major',
      tip: 'Brace your abs and squeeze your glutes to hold a straight line from head to heels.',
      views: ['side', 'diagonal'],
      phases: ['start', 'going', 'target', 'returning'],
      persistMs: 350,
      joints: [LM.LEFT_HIP, LM.RIGHT_HIP],
      check: (f) => {
        const sag = bodyLineSag(f);
        return sag === null ? null : sag > 0.06;
      },
    },
    {
      id: 'hips_piking',
      title: 'Hips too high',
      cues: ['Lower your hips', 'Straight line — hips down a bit'],
      severity: 'minor',
      tip: 'Drop your hips into a straight line with your shoulders and heels.',
      views: ['side', 'diagonal'],
      phases: ['start', 'going', 'target', 'returning'],
      persistMs: 400,
      joints: [LM.LEFT_HIP, LM.RIGHT_HIP],
      check: (f) => {
        const sag = bodyLineSag(f);
        return sag === null ? null : sag < -0.09;
      },
    },
    {
      id: 'head_dropping',
      title: 'Head dropping',
      cues: ['Keep your neck neutral', "Don't drop your head — eyes just ahead of your hands"],
      severity: 'minor',
      tip: 'Keep your head in line with your spine instead of letting it hang.',
      views: ['side'],
      persistMs: 400,
      joints: [LM.NOSE, LM.LEFT_EAR, LM.RIGHT_EAR],
      check: (f) => {
        const d = headDrop(f);
        return d === null ? null : d > 0.2;
      },
    },
  ],
  praise: ['Great push-up!', 'Nice and deep!', 'Solid rep!', 'Strong!', 'Perfect line!'],
  defaultTarget: 10,
  targetOptions: [5, 8, 10, 15, 20, 25, 0],
};

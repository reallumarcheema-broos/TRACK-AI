import type { ExerciseDef, ExerciseId } from '../core/exercise';
import { curl } from './curl';
import { jumpingJack } from './jumpingJack';
import { lunge } from './lunge';
import { plank } from './plank';
import { press } from './press';
import { pushup } from './pushup';
import { rdl } from './rdl';
import { squat } from './squat';

export const EXERCISES: readonly ExerciseDef[] = [squat, pushup, lunge, rdl, curl, press, jumpingJack, plank];

export const EXERCISE_BY_ID: Record<ExerciseId, ExerciseDef> = Object.fromEntries(
  EXERCISES.map((e) => [e.id, e]),
) as Record<ExerciseId, ExerciseDef>;

export { curl, jumpingJack, lunge, plank, press, pushup, rdl, squat };

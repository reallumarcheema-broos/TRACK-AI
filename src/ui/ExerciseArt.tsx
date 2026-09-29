import type { ExerciseId } from '../core/exercise';
import { personPhoto } from '../media/people';

const MONOGRAM: Record<ExerciseId, string> = {
  squat: 'Sq',
  pushup: 'Pu',
  lunge: 'Lu',
  rdl: 'RD',
  curl: 'Cu',
  press: 'Pr',
  jumping_jack: 'JJ',
  plank: 'Pl',
};

/**
 * Picture for an exercise: a photo of an AI-generated person (who doesn't exist) when one is
 * bundled, otherwise a plain monogram tile.
 */
export function ExerciseArt({ id }: { id: ExerciseId }) {
  const photo = personPhoto(id);
  return (
    <span className="exercise-art" aria-hidden="true">
      {photo ? <img src={photo} alt="" loading="lazy" decoding="async" /> : <span className="mono">{MONOGRAM[id]}</span>}
    </span>
  );
}

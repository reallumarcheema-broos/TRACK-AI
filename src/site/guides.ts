import type { ExerciseId } from '../core/exercise';

/** Written form guides, one per exercise; the common mistakes come from the coach's own checks. */
export interface Guide {
  title: string;
  /** Page description for search results. */
  summary: string;
  intro: string;
  steps: string[];
  /** How many reps or seconds, and how to progress. */
  programming: string;
  easier: string;
  harder: string;
  safety: string;
}

export const GUIDES: Record<ExerciseId, Guide> = {
  squat: {
    title: 'How to do a squat',
    summary: 'How to squat with good form: foot position, depth, knee tracking and the mistakes to avoid, step by step.',
    intro:
      'The squat is the foundation of lower-body strength. It trains your thighs, glutes and core, and it is the same movement you use every time you sit down and stand up. Done well, it is one of the safest and most useful exercises there is.',
    steps: [
      'Stand with your feet about shoulder-width apart and your toes turned out slightly, around 10 to 30 degrees.',
      'Brace your core as if someone were about to poke you in the stomach, and keep your chest up.',
      'Push your hips back and bend your knees at the same time, letting your knees travel out in line with your toes.',
      'Lower until your thighs are at least parallel to the floor, keeping your whole foot planted.',
      'Drive through the middle of your foot to stand up, squeezing your glutes until your hips and knees are fully straight.',
    ],
    programming:
      'Start with 2 to 3 sets of 8 to 12 bodyweight squats, resting about a minute between sets. When 15 clean reps feel easy, hold a dumbbell or kettlebell at your chest (a goblet squat) or take three seconds on the way down.',
    easier: 'Squat down to a chair or box and stand back up, or hold a door frame for balance.',
    harder: 'Goblet squats, pause squats (hold the bottom for two seconds) or barbell squats with a coach.',
    safety:
      'Stop if you feel sharp pain in your knees, hips or back. Knees travelling a little past your toes is normal; knees caving inward is what to avoid.',
  },
  pushup: {
    title: 'How to do a push-up',
    summary: 'How to do a push-up with good form: hand position, a straight body line, full depth and easier and harder versions.',
    intro:
      'The push-up builds your chest, shoulders and triceps while your core works hard to hold a straight line. It needs no equipment and scales from complete beginner to advanced.',
    steps: [
      'Place your hands on the floor slightly wider than your shoulders, fingers pointing forward.',
      'Step your feet back so your body forms one straight line from head to heels. Squeeze your glutes and brace your core.',
      'Lower your chest toward the floor with your elbows at about 45 degrees to your body, not flared straight out.',
      'Go down until your chest is about a fist’s height from the floor.',
      'Press the floor away until your arms are straight, keeping your hips in line the whole time.',
    ],
    programming:
      'Do 3 sets of as many clean reps as you can, stopping one or two reps before your form breaks. Add a rep or two each week; once you can do 20, move on to a harder version.',
    easier: 'Put your hands on a bench, table or wall (the higher the surface, the easier), or drop to your knees while keeping your hips in line.',
    harder: 'Feet raised on a step, a slow three-second lowering, or a pause just above the floor.',
    safety:
      'Keep your neck neutral by looking at the floor just ahead of your hands. If your wrists hurt, try push-up handles or a closed fist on a soft surface.',
  },
  lunge: {
    title: 'How to do a lunge',
    summary: 'How to do a lunge with good form: step length, knee position and balance, plus reverse lunges and split squats.',
    intro:
      'Lunges train one leg at a time, which builds strength, balance and hip stability and helps even out differences between your left and right side.',
    steps: [
      'Stand tall with your feet hip-width apart and your hands on your hips.',
      'Take a big step forward (or backward, for a reverse lunge) and lower your back knee toward the floor.',
      'Keep your torso upright and your front knee in line with your middle toes.',
      'Lower until both knees are bent to about 90 degrees and your back knee is just above the floor.',
      'Push through your front heel to come back up, then switch legs.',
    ],
    programming:
      'Do 2 to 3 sets of 8 to 10 reps per leg. Reverse lunges are easier on the knees than forward lunges and are a good place to start.',
    easier: 'Split squats: keep both feet in place and just move up and down, holding a wall or chair for balance.',
    harder: 'Hold dumbbells, try walking lunges, or rest your back foot on a bench (Bulgarian split squats).',
    safety:
      'A short step pushes the front knee far forward; a longer step shares the work with your glutes. Don’t let the front knee collapse inward.',
  },
  rdl: {
    title: 'How to do a Romanian deadlift',
    summary: 'How to do a Romanian deadlift: the hip hinge, a flat back and the hamstring stretch, with weights or a broomstick.',
    intro:
      'The Romanian deadlift teaches the hip hinge, bending at the hips while your back stays flat, and builds the hamstrings and glutes. It is the movement behind safely lifting anything off the floor.',
    steps: [
      'Stand with your feet hip-width apart, holding dumbbells or a bar in front of your thighs.',
      'Soften your knees slightly and keep them at that angle for the whole rep.',
      'Push your hips straight back, letting the weights slide down close to your legs while your back stays flat.',
      'Lower until you feel a strong stretch in your hamstrings, usually around mid-shin.',
      'Squeeze your glutes and drive your hips forward to stand tall, without leaning back at the top.',
    ],
    programming:
      'Start light: 3 sets of 8 to 10 reps with a slow, controlled lowering. Add weight only when your back stays flat on every rep.',
    easier: 'Practise with a broomstick along your spine touching your head, upper back and tailbone, or hinge back until your hips touch a wall.',
    harder: 'Single-leg Romanian deadlifts, or a two-second pause at the bottom.',
    safety: 'Never round your lower back to reach further; the range comes from your hips. Keep the weight close to your legs.',
  },
  curl: {
    title: 'How to do a bicep curl',
    summary: 'How to do a bicep curl with strict form: fixed elbows, full range and no swinging.',
    intro:
      'The bicep curl works the front of your upper arm. It is simple, but strict form, with no swinging, is what actually builds the muscle.',
    steps: [
      'Stand tall holding dumbbells at your sides, palms facing forward.',
      'Pin your elbows to your sides; they should stay there for the whole rep.',
      'Curl the weights up by bending your elbows until your forearms are nearly vertical.',
      'Squeeze at the top for a moment.',
      'Lower slowly until your arms are fully straight again.',
    ],
    programming:
      'Do 3 sets of 10 to 15 reps with a weight you can lift without leaning back. Lowering over two or three seconds makes a light weight much more effective.',
    easier: 'Use lighter dumbbells, water bottles or a resistance band, or curl one arm at a time.',
    harder: 'A slower tempo, hammer curls (palms facing in) or a heavier weight with the same strict form.',
    safety: 'If you have to swing your body to lift the weight, it is too heavy.',
  },
  press: {
    title: 'How to do a shoulder press',
    summary: 'How to do a standing shoulder press: bracing, full lockout, even arms and how to avoid leaning back.',
    intro:
      'The overhead press builds strong, stable shoulders and triceps, and your core has to work to keep you upright while you do it.',
    steps: [
      'Stand with your feet hip-width apart, holding dumbbells at shoulder height, palms facing forward or slightly in.',
      'Brace your core and squeeze your glutes so your lower back doesn’t arch.',
      'Press the weights straight up until your arms are fully straight overhead, biceps close to your ears.',
      'Keep both arms moving at the same speed and height.',
      'Lower under control back to shoulder height.',
    ],
    programming: 'Do 3 sets of 8 to 12 reps. Increase the weight only when you can lock out every rep without leaning back.',
    easier: 'Press seated with your back supported, or one arm at a time.',
    harder: 'A pause at the top, a slow three-second lowering, or a barbell press.',
    safety:
      'Leaning back turns the press into an incline press and loads your lower back, so use a lighter weight instead. Skip it if raising your arms overhead hurts your shoulder.',
  },
  jumping_jack: {
    title: 'How to do jumping jacks',
    summary: 'How to do jumping jacks properly: full arm range, wide feet, soft landings and low-impact options.',
    intro:
      'Jumping jacks raise your heart rate and warm up your whole body in under a minute, which makes them a perfect warm-up or cardio finisher.',
    steps: [
      'Stand tall with your feet together and your arms at your sides.',
      'Jump your feet out wider than your shoulders while swinging your arms out and up.',
      'Bring your hands all the way overhead so they nearly touch.',
      'Jump back to the start, feet together and arms down.',
      'Land softly on the balls of your feet and keep a steady rhythm.',
    ],
    programming:
      'Use 30 to 60 seconds (20 to 50 reps) as a warm-up, or do intervals: 30 seconds on and 30 seconds rest, for five rounds.',
    easier: 'Step jacks: step one foot out at a time instead of jumping.',
    harder: 'Go faster, or sink into a squat each time your feet land wide (squat jacks).',
    safety: 'Land softly with bent knees. Choose the step version if you have knee or pelvic-floor concerns.',
  },
  plank: {
    title: 'How to do a plank',
    summary: 'How to hold a plank with good form: a straight line from head to heels, level hips and how long to hold.',
    intro:
      'The plank trains your core to resist sagging and twisting, which is the job it does in everyday life and in every other lift.',
    steps: [
      'Place your forearms on the floor with your elbows under your shoulders.',
      'Step your feet back so your body forms a straight line from head to heels.',
      'Squeeze your glutes, brace your abs and push the floor away with your forearms.',
      'Keep your hips level, neither sagging toward the floor nor piking up.',
      'Breathe steadily and hold, with your neck neutral.',
    ],
    programming:
      'Build up to 3 holds of 30 to 60 seconds. Longer isn’t better once your form breaks: end the hold when your hips start to drop.',
    easier: 'Hold the plank from your knees, or with your hands on a bench.',
    harder: 'Lift one foot or one arm, or try a side plank.',
    safety: 'Stop if you feel it in your lower back rather than your stomach; that usually means your hips are sagging.',
  },
};

/**
 * Training articles for the website's /articles section. Text supports **bold** and
 * [links](/guides/squat) to the site's own pages. What they say about the coach (fault names, camera
 * views, the plank timer) matches the exercise definitions in src/exercises.
 */

import type { ExerciseId } from '../core/exercise';

export type Block = { h2: string } | { p: string } | { ul: string[] } | { ol: string[] } | { tip: string };

export interface Article {
  slug: string;
  title: string;
  /** Page description for search results and the article list. */
  summary: string;
  /** ISO date. */
  published: string;
  /** The exercises it's mainly about; their guides list it first among related articles. */
  about?: ExerciseId[];
  blocks: Block[];
}

export const ARTICLES: Article[] = [
  {
    slug: 'beginner-full-body-workout',
    title: 'A 20-minute beginner full-body workout (no equipment)',
    summary: 'A simple bodyweight workout for beginners with squats, push-ups, lunges, planks and jumping jacks, plus a four-week plan to keep progressing.',
    published: '2026-09-30',
    blocks: [
      {
        p: 'You don’t need a gym, a bench or a set of dumbbells to get stronger. Five classic bodyweight exercises, done well, train your legs, chest, shoulders and core and raise your heart rate, all in about twenty minutes. Do this workout three times a week, with a rest day in between, and you will feel the difference within a month.',
      },
      { h2: 'What you need' },
      {
        ul: [
          'A clear space about two metres square, with nothing to trip over.',
          'Flat-soled shoes, or bare feet on a floor that isn’t slippery.',
          'A sturdy table, bench or kitchen counter for easier push-ups.',
          'Water, and your phone if you want the coach to count your reps.',
        ],
      },
      { h2: 'Warm up first (3 minutes)' },
      {
        ol: [
          '60 seconds of [jumping jacks](/guides/jumping_jack), or step jacks if you’d rather not jump.',
          '10 slow [bodyweight squats](/guides/squat) to a comfortable depth.',
          '10 arm circles forwards and 10 backwards.',
          '5 reverse [lunges](/guides/lunge) on each leg.',
        ],
      },
      { p: 'You should feel warm and slightly out of breath, not tired. The [warm-up guide](/articles/warm-up) explains why this matters.' },
      { h2: 'The workout' },
      { p: 'Do the five exercises one after another as a circuit, resting about 20 seconds between them. That is one round. Rest 60 to 90 seconds, then repeat.' },
      {
        ol: [
          '**[Squats](/guides/squat):** 10 reps. Thighs at least parallel to the floor, heels down.',
          '**[Push-ups](/guides/pushup):** 6 to 10 reps. Put your hands on a bench or table if the floor is too hard for now.',
          '**[Reverse lunges](/guides/lunge):** 8 reps on each leg.',
          '**[Plank](/guides/plank):** hold for 20 to 30 seconds with your hips level.',
          '**[Jumping jacks](/guides/jumping_jack):** 30 seconds, hands all the way overhead.',
        ],
      },
      { h2: 'Why these five exercises?' },
      {
        p: 'Together they cover the main ways your body moves. Squats and lunges train your thighs and glutes, the biggest muscles you have, and lunges challenge your balance one leg at a time. Push-ups work your chest, shoulders and triceps while your core holds you straight. The plank trains your core to resist sagging, the same job it does when you lift, carry and stand. Jumping jacks raise your heart rate between the strength moves, so the circuit doubles as light cardio.',
      },
      { h2: 'How hard should it feel?' },
      {
        p: 'Stop each exercise when you could still do two or three more good reps. That is hard enough to make progress without letting your form fall apart. If a rep doesn’t reach full depth, it doesn’t count, so slow down rather than rushing to hit a number.',
      },
      { h2: 'Make it easier or harder' },
      {
        ul: [
          '**Squats:** for easier, sit down onto a chair and stand back up; for harder, pause for two seconds at the bottom.',
          '**Push-ups:** for easier, put your hands on a wall or kitchen counter; for harder, hands on the floor, then feet on a step.',
          '**Lunges:** for easier, hold a chair for balance, or do split squats without stepping; for harder, take three seconds to lower.',
          '**Plank:** for easier, keep your knees down; for harder, lift one foot for a few seconds at a time, switching sides.',
          '**Jumping jacks:** for easier, do step jacks, stepping one foot out at a time; for harder, keep going for 45 seconds.',
        ],
      },
      { h2: 'Your four-week plan' },
      {
        ul: [
          '**Week 1:** two rounds, three days a week (for example Monday, Wednesday and Friday).',
          '**Week 2:** three rounds.',
          '**Week 3:** add two reps to each exercise and 10 seconds to the plank.',
          '**Week 4:** take three seconds to lower on every squat, push-up and lunge.',
        ],
      },
      { p: 'After four weeks, use the ideas in [progressive overload at home](/articles/progressive-overload-at-home) to keep the workout challenging.' },
      { h2: 'Common beginner mistakes' },
      {
        ul: [
          '**Rushing.** Fast, bouncy reps use momentum instead of muscle. Take about two seconds to lower and one to come back up.',
          '**Holding your breath.** Breathe in on the way down and out as you push or stand up.',
          '**Doing too much in week one.** Finish feeling that you could have done a little more. Being very sore for days only delays your next session.',
          '**Chasing numbers.** Ten full squats beat fifteen half squats. If a rep doesn’t reach full range, it doesn’t count.',
          '**Skipping rest days.** Your muscles adapt between sessions, so rest (or an easy walk) is part of the plan.',
        ],
      },
      { h2: 'What to expect in the first weeks' },
      {
        p: 'Some muscle soreness a day or two after your first sessions is normal, especially in your thighs. It usually peaks within one to three days and eases as your body gets used to the work. Sharp pain, pain in a joint, or pain that gets worse as you move is different: stop that exercise and get it checked.',
      },
      {
        p: 'Expect your numbers to climb quickly at first. Much of the early progress comes from your nervous system learning to use the muscles you already have, so reps feel smoother and steadier within a couple of weeks. That progress is real, and it’s a great reason to keep going.',
      },
      { h2: 'How it fits into a healthy week' },
      {
        p: 'The World Health Organization recommends that adults do muscle-strengthening activities on two or more days a week, plus 150 to 300 minutes of moderate aerobic activity such as brisk walking or cycling. Three sessions of this workout cover the strength part. Add walks, bike rides or anything else that gets you moving on the other days, and read [rest days and recovery](/articles/rest-days-and-recovery) to balance the two.',
      },
      { h2: 'Cool down' },
      { p: 'Finish with three to five minutes of easy walking and a few gentle stretches for your thighs, hips and chest, holding each for about 20 to 30 seconds.' },
      {
        tip: 'Prop your phone up and let the TRACK AI coach count your squats, push-ups and lunges. It flags half reps and form slips out loud, and your form score shows up in your history after every set.',
      },
      {
        p: 'If you are new to exercise, pregnant, or have a heart condition, joint problem or other medical condition, check with a doctor before you start.',
      },
    ],
  },
  {
    slug: 'warm-up',
    title: 'How to warm up before a workout: a 5-minute routine',
    summary: 'Why warming up matters and a five-minute routine that gets your joints, muscles and heart ready to train, with versions for legs, upper body and cardio.',
    published: '2026-09-30',
    blocks: [
      {
        p: 'A good warm-up doesn’t need to be long. Five minutes of the right movements raises your heart rate and body temperature, takes your joints through the range you’re about to use, and lets you rehearse the exercises at an easy effort. Most people find their first working sets feel smoother and stronger afterwards.',
      },
      { h2: 'What a warm-up should do' },
      {
        ul: [
          'Raise your heart rate and warm your muscles.',
          'Move your hips, knees, ankles and shoulders through a full range of motion.',
          'Practise the movement pattern you’re about to train, at a low effort.',
          'Shift your attention from your day to your workout.',
        ],
      },
      { h2: 'The five-minute routine' },
      {
        ol: [
          '**60 seconds** of [jumping jacks](/guides/jumping_jack) or marching on the spot.',
          '**10 arm circles** forwards and 10 backwards, small then big.',
          '**10 slow [squats](/guides/squat)** to a comfortable depth, pausing briefly at the bottom.',
          '**5 reverse [lunges](/guides/lunge)** on each leg.',
          '**10 hip hinges:** hands on hips, push your hips back with a flat back, as in a [Romanian deadlift](/guides/rdl).',
          '**20 seconds** of [plank](/guides/plank), or 5 slow [push-ups](/guides/pushup) with your hands on a bench.',
          '**One or two easy sets** of your first exercise before you start counting.',
        ],
      },
      { h2: 'Tailor it to your workout' },
      {
        ul: [
          '**Legs:** add 10 glute bridges and a few squats with a two-second pause at the bottom.',
          '**Upper body:** add 10 push-ups against a wall, 10 slow arm swings across your chest and a few shoulder rolls.',
          '**Cardio or intervals:** build your pace over a few minutes: march, then jog on the spot, then two short, faster bursts before the real thing.',
          '**Weights:** do two or three lighter sets of your first exercise, adding a little weight each time, before your working sets.',
        ],
      },
      { h2: 'Should you stretch before training?' },
      {
        p: 'Long, static stretches (holding one position for a minute or more) right before lifting can briefly reduce strength and power for some people. Short, moving stretches like the ones above are a better choice before training. Keep longer stretches for after your workout or for a separate session.',
      },
      { h2: 'How do you know you’re warm?' },
      {
        p: 'You’re slightly out of breath, your body feels warm, and your joints move freely. You should not feel tired. If you do, the warm-up was a workout.',
      },
      { h2: 'When to warm up for longer' },
      {
        p: 'Add a few more minutes on cold mornings, after a long day of sitting, before heavier lifting, or if a joint feels stiff. Build up gradually: more range, then a little more speed or load.',
      },
      { h2: 'Common warm-up mistakes' },
      {
        ul: [
          '**Turning it into a workout.** If you’re tired before your first real set, do less.',
          '**Only stretching.** Holding stretches doesn’t raise your heart rate or rehearse the movement.',
          '**Skipping it when you’re short on time.** Cut a set from the workout instead; even three minutes helps.',
          '**Jumping straight to your hardest set.** Build up: easy, then moderate, then working effort.',
        ],
      },
      { h2: 'Does warming up prevent injuries?' },
      {
        p: 'Structured warm-up programmes have been shown to reduce injuries in some team sports, such as football. For a home workout, the most noticeable benefit is that you move better: your first reps are smoother, and if a joint feels off, you notice while the effort is still low.',
      },
      { h2: 'And cooling down?' },
      {
        p: 'A cool-down isn’t essential, but a few minutes of easy walking lets your breathing and heart rate settle, and it’s a good moment for the longer stretches that don’t belong in your warm-up. Hold each one for 20 to 30 seconds and breathe slowly.',
      },
      { tip: 'The TRACK AI coach asks you to hold still for a second before each set so it can calibrate to your body. The last move of your warm-up is a good moment to set your phone up.' },
    ],
  },
  {
    slug: 'sets-and-reps',
    title: 'How many sets and reps should you do?',
    summary: 'A plain-English guide to sets, reps and rest for strength, muscle and endurance, how to tell when a set is hard enough, and a sample week.',
    published: '2026-09-30',
    blocks: [
      {
        p: 'There is no single perfect number of reps. The right answer depends on your goal, and the good news is that a wide range works well, as long as each set is hard enough. Here is how to choose.',
      },
      { h2: 'The short answer' },
      {
        p: 'For general fitness, do **2 to 4 sets of 8 to 15 reps** of each exercise, **2 or 3 times a week**, and end each set when you could only do one to three more good reps. Rest one to two minutes between sets.',
      },
      { h2: 'Reps by goal' },
      {
        ul: [
          '**Strength:** heavier sets of about 3 to 6 reps, with longer rest (two to five minutes). With bodyweight exercises, use harder variations to get into this range.',
          '**Muscle:** a broad range, roughly 6 to 30 reps, builds muscle as long as sets end close to failure. Many people find 8 to 15 the most comfortable.',
          '**Endurance:** 15 reps or more, or timed sets like a 45-second [plank](/guides/plank), with shorter rest.',
        ],
      },
      { h2: 'Reps in reserve: how hard is hard enough?' },
      {
        p: '“Reps in reserve” means how many more good reps you could have done when you stopped. For most sets, aim for one to three. The last reps should be slow and challenging, but your form should still hold. If you could have done six more, the set was too easy; if your form breaks down, it went too far.',
      },
      { h2: 'How long to rest between sets' },
      {
        ul: [
          '**Most sets:** one to two minutes, enough to do the next set about as well as the last.',
          '**Heavy strength work:** two to five minutes. Cutting rest short here mostly costs you reps.',
          '**Circuits and endurance:** 30 to 60 seconds, or go straight to an exercise that uses different muscles.',
        ],
      },
      { h2: 'How many sets per week?' },
      {
        p: 'Beginners make great progress with about 6 to 10 hard sets per muscle group per week, spread over two or three sessions. As you get fitter, add a set here and there, and back off if you’re always sore or your performance drops.',
      },
      { h2: 'A simple way to progress: double progression' },
      {
        p: 'Pick a rep range, such as 8 to 12. Start with a variation or weight you can do for 8 good reps. Each session, try to add a rep or two. When you reach 12 reps on every set with good form, make the exercise harder (a tougher variation, a slower lowering or more weight) and start again at 8. It works for bodyweight exercises and weights alike, and it stops you adding difficulty before you’re ready.',
      },
      { h2: 'A sample week' },
      { p: 'Alternate these two workouts, two or three times a week, with at least one day between sessions.' },
      { p: '**Workout A**' },
      {
        ul: [
          '[Squats](/guides/squat): 3 sets of 8 to 12.',
          '[Push-ups](/guides/pushup): 3 sets of 6 to 12, hands raised if needed.',
          '[Romanian deadlifts](/guides/rdl): 3 sets of 10 to 12, holding dumbbells or a loaded backpack.',
          '[Plank](/guides/plank): 3 holds of 20 to 45 seconds.',
        ],
      },
      { p: '**Workout B**' },
      {
        ul: [
          '[Reverse lunges](/guides/lunge): 3 sets of 8 to 10 on each leg.',
          '[Shoulder press](/guides/press): 3 sets of 8 to 12 with dumbbells.',
          '[Bicep curls](/guides/curl): 2 sets of 10 to 15.',
          '[Jumping jacks](/guides/jumping_jack): 3 rounds of 30 to 45 seconds.',
        ],
      },
      { h2: 'What about bodyweight exercises?' },
      {
        p: 'Once you can do more than about 20 clean reps, adding more reps becomes a test of endurance and patience. Make the exercise harder instead: slow the lowering down, add a pause, or move to a harder variation. [Progressive overload at home](/articles/progressive-overload-at-home) lists seven ways to do it.',
      },
      { h2: 'Signs your numbers need to change' },
      {
        ul: [
          'Every set feels easy and your last reps are as quick as your first: make it harder.',
          'You miss your target reps with good form two sessions in a row: rest longer between sets, or use an easier variation for a week or two.',
          'You’re sore for days after every session: drop a set from each exercise for a week.',
        ],
      },
      { h2: 'Quality counts' },
      {
        p: 'A rep that stops short of full depth or lockout isn’t a full rep. Counting only good reps is the simplest way to make sure your numbers mean something.',
      },
      { tip: 'The TRACK AI coach doesn’t count half reps and calls out reps that don’t lock out, so your rep count reflects real work.' },
    ],
  },
  {
    slug: 'progressive-overload-at-home',
    title: 'Progressive overload at home: keep getting stronger without a gym',
    summary: 'Seven ways to keep making bodyweight exercises harder as you get stronger, step-by-step progressions for each movement, and what to do when you plateau.',
    published: '2026-09-30',
    blocks: [
      {
        p: 'Your body adapts to what you ask of it. The workout that challenged you in week one will feel easy by week six, and easy workouts stop producing results. The fix is progressive overload: gradually making your training a little harder over time. You can do that at home without any equipment.',
      },
      { h2: 'Seven ways to progress' },
      {
        ol: [
          '**Add reps,** up to about 15 to 20 per set. Beyond that, change something else.',
          '**Add a set** to your main exercises.',
          '**Slow the lowering.** Take three or four seconds to lower into each [squat](/guides/squat) or [push-up](/guides/pushup).',
          '**Pause at the hardest point,** for example two seconds at the bottom of a squat or just above the floor in a push-up.',
          '**Move to a harder variation:** incline push-ups to floor push-ups to feet-raised push-ups; split squats to [lunges](/guides/lunge) to rear-foot-raised split squats.',
          '**Go single-leg or single-arm,** or make the exercise less stable.',
          '**Add weight:** a backpack with books, water bottles or a pair of dumbbells.',
        ],
      },
      { h2: 'Step-by-step progressions' },
      {
        ul: [
          '**Push-ups:** wall, then kitchen counter, then bench, then floor, then feet on a step.',
          '**Squats:** squat to a chair, then a full bodyweight squat, then a pause squat, then holding a backpack or dumbbell at your chest (a goblet squat).',
          '**Lunges:** split squat holding a chair, then reverse lunge, then forward lunge, then walking lunge, then rear foot raised on a bench.',
          '**Plank:** knees down, then a full plank, then holds of up to about a minute, then lifting one foot or one hand in turn. See [how long to hold a plank](/articles/how-long-to-hold-a-plank).',
          '**Hinge:** a hands-on-hips hip hinge, then a [Romanian deadlift](/guides/rdl) with a backpack, then dumbbells, then a single-leg version.',
        ],
      },
      { h2: 'Change one thing at a time' },
      {
        p: 'Pick one lever and pull it gently. Adding two reps is progress; adding reps, sets and a pause in the same week is a recipe for sore joints and sloppy form.',
      },
      { h2: 'When to move up a level' },
      {
        p: 'A good rule: move to the next step when you can do all your sets at the top of your rep range, for example 3 sets of 12 to 15, with good form and a couple of reps to spare. When you step up, your reps will drop. That’s expected. Build them back up, then step up again.',
      },
      { h2: 'Keep a log' },
      {
        p: 'Write down what you did, or let an app do it. Progress means more good reps at the same quality, or the same reps with a harder variation. If your form score drops as your reps climb, you added too much too soon.',
      },
      { h2: 'Recover to improve' },
      {
        p: 'You get stronger between workouts, not during them. Sleep well, eat enough protein, give each muscle group a day or two between hard sessions, and every four to eight weeks take an easier week to recharge. [Rest days and recovery](/articles/rest-days-and-recovery) explains how.',
      },
      { h2: 'Plateaus happen' },
      {
        p: 'Progress is rarely a straight line. If you’ve been stuck for two or three weeks, check the basics first: sleep, stress and whether you’re eating enough. Then try a new variation of the same movement, change your rep range for a few weeks, or take an easier week. The session after a lighter week is often your best in a while.',
      },
      { tip: 'TRACK AI saves every set with its rep count and form score, so you can see at a glance whether you’re getting stronger without cutting corners. Start with the [beginner full-body workout](/articles/beginner-full-body-workout).' },
    ],
  },
  {
    slug: 'rest-days-and-recovery',
    title: 'Rest days: how much recovery do you need?',
    summary: 'How many rest days to take, what to do on them, how to tell normal soreness from pain, and the sleep and food habits that help you recover.',
    published: '2026-09-30',
    blocks: [
      {
        p: 'Training is the signal; recovery is when your body answers it. Muscles repair and adapt in the hours and days after a workout, not during it. That’s why more training isn’t always better, and why rest days are part of a good plan rather than a break from it.',
      },
      { h2: 'How many rest days do you need?' },
      {
        p: 'For strength training, a simple rule works for most people: give each muscle group at least one day, often two, between hard sessions. With a full-body workout, that means training on two or three non-consecutive days a week, such as Monday, Wednesday and Friday. If you want to train more often, alternate muscle groups, for example lower body one day and upper body the next.',
      },
      { h2: 'Rest doesn’t mean doing nothing' },
      {
        p: 'Light activity on your days off, such as walking, easy cycling, swimming or gentle mobility work, keeps you moving without adding much fatigue. Many people find it helps stiffness settle faster than a day on the sofa, and it counts towards the 150 to 300 minutes of moderate activity a week that health guidelines recommend.',
      },
      { h2: 'Soreness or pain?' },
      {
        ul: [
          '**Normal muscle soreness** (often called DOMS, delayed-onset muscle soreness) feels like a dull ache or tightness in the muscles you trained. It usually starts the day after a new or harder workout, peaks within one to three days and fades on its own. It’s fine to train other muscles, or the same ones lightly.',
          '**Pain to take seriously** is sharp, sits in a joint rather than a muscle, comes with swelling, or gets worse as you move. Stop the exercise that causes it, and see a doctor or physiotherapist if it doesn’t settle.',
        ],
      },
      {
        p: 'Soreness isn’t a measure of a good workout. As your body adapts, you’ll feel less sore after the same session, even though it’s still working.',
      },
      { h2: 'Signs you need more rest' },
      {
        ul: [
          'Your performance drops for several sessions in a row.',
          'You feel tired all the time, or you’re sleeping badly.',
          'Your usual warm-up feels heavy and hard.',
          'Aches that used to fade in a day or two now hang around.',
          'You’ve lost your motivation to train.',
        ],
      },
      {
        p: 'If a few of these sound familiar, take two or three easy days, or train at about half your usual volume for a week. It’s a small price for coming back fresher.',
      },
      { h2: 'Sleep: the best recovery tool' },
      {
        p: 'Adults are generally advised to get at least seven hours of sleep a night. A lot of repair happens while you sleep, and short nights make training feel harder. A regular bedtime, a dark and cool bedroom and a break from screens before bed all help.',
      },
      { h2: 'Eat to recover' },
      {
        p: 'Your muscles need enough energy and protein to rebuild. Include a source of protein in each meal, such as eggs, dairy, fish, meat, tofu, beans or lentils, and avoid training on an empty tank if it leaves you feeling weak. Drink water through the day, especially around workouts.',
      },
      { h2: 'Take an easier week' },
      {
        p: 'Every four to eight weeks, many people who lift take a lighter week: fewer sets, lighter weights or easier variations. It lets built-up fatigue clear, and it’s a good moment to refresh your plan. The first sessions after an easier week often feel like your best.',
      },
      { h2: 'A balanced week' },
      {
        ul: [
          '**Monday:** full-body strength workout.',
          '**Tuesday:** a 30-minute walk or bike ride.',
          '**Wednesday:** full-body strength workout.',
          '**Thursday:** rest, or gentle mobility and stretching.',
          '**Friday:** full-body strength workout.',
          '**Weekend:** something active you enjoy, and a proper rest day.',
        ],
      },
      { tip: 'TRACK AI keeps a history of every set with its form score. If your scores slide across a few sessions, fatigue may be catching up with you, and a rest day might do more than another workout.' },
    ],
  },
  {
    slug: 'knees-caving-in-squat',
    title: 'Knees caving in when you squat? How to fix it',
    summary: 'Why knees cave inward during squats and lunges (knee valgus), with five cues, three drills and an ankle check to keep them tracking over your toes.',
    published: '2026-09-30',
    about: ['squat'],
    blocks: [
      {
        p: 'If your knees drift towards each other as you stand up from a squat, you’re not alone. Coaches call it knee valgus, and it’s one of the most common squat faults. A little movement isn’t automatically harmful, but repeatedly letting your knees collapse, especially under load, is worth fixing. The goal is control: knees that track in line with your toes all the way down and up.',
      },
      { h2: 'Why it happens' },
      {
        ul: [
          'Your glutes, the muscles that turn your thighs outwards, aren’t doing their share.',
          'Your arches collapse and your feet roll inward.',
          'Your stance is too narrow or your toes point in a different direction from your knees.',
          'Stiff ankles push your knees inward to find depth.',
          'Fatigue at the end of a set, or a weight that is simply too heavy.',
        ],
      },
      { h2: 'Five fixes that work' },
      {
        ol: [
          '**“Spread the floor.”** Grip the floor with your feet and imagine pushing it apart. Your knees follow.',
          '**Keep a foot tripod.** Keep your weight on your heel, big toe and little toe so your arch doesn’t collapse.',
          '**Find your stance.** Try feet about shoulder-width apart with your toes turned out 10 to 30 degrees, and point your knees the same way as your toes.',
          '**Use a light band.** A mini band just above your knees gives you something to push out against during bodyweight squats.',
          '**Slow down and lighten up.** Take three seconds to lower, pause at the bottom, and use a load you can control on every rep.',
        ],
      },
      { h2: 'Knees past your toes is a different thing' },
      {
        p: 'Knees caving in often gets mixed up with knees travelling forward. In a deep squat, your knees moving forward past your toes is normal for most people, and trying to stop it usually just tips your chest further forward. What matters for this fault is the side-to-side line: knees pointing the same way as your toes.',
      },
      { h2: 'Three drills that build control' },
      {
        ol: [
          '**Glute bridges.** Lie on your back with your knees bent and feet hip-width apart. Push through your heels to lift your hips until they line up with your knees and shoulders, keeping your knees apart. 2 sets of 12 to 15.',
          '**Band side steps.** With a mini band just above your knees, sink into a quarter squat and take 10 to 15 small steps to each side, keeping your knees pushed out and your toes forward.',
          '**Box squats.** Squat down to a chair or bench, pause for two seconds without relaxing, and stand up, watching your knees in a mirror or on camera. 2 sets of 8.',
        ],
      },
      { h2: 'Check your ankles' },
      {
        p: 'Stiff ankles are a common hidden cause. Try the knee-to-wall test: kneel on one knee facing a wall, put your front foot about 10 centimetres from it, and push your front knee forward to touch the wall without lifting your heel. If you can’t, practise that movement for a minute a day, and in the meantime try squatting with your heels on a thin weight plate or a folded towel.',
      },
      { h2: 'Check it on camera' },
      {
        p: 'Knee position is easiest to see from the front. Film a set facing the camera, or face your phone during a TRACK AI squat set: the coach calls out **“Knees caving in”** and marks the rep in your summary. The same cues help in [lunges](/guides/lunge), where the front knee likes to drift inward too.',
      },
      { h2: 'When to get help' },
      {
        p: 'If you have pain on the inside of your knee, swelling, or clicking that hurts, stop and see a physiotherapist or doctor. Form cues are for control, not for training through pain.',
      },
      { tip: 'Read the full [squat form guide](/guides/squat) for step-by-step technique and the other mistakes the coach checks.' },
    ],
  },
  {
    slug: 'pushup-hips-sagging',
    title: 'Hips sagging in push-ups and planks? How to fix it',
    summary: 'Why your hips sag or pike during push-ups and planks, how to set up your hands and elbows, and a four-week progression to a straight-line push-up.',
    published: '2026-09-30',
    about: ['pushup', 'plank'],
    blocks: [
      {
        p: 'A push-up is a moving plank. Your chest and arms do the pushing, but your core has to keep your body in one straight line from your head to your heels. When it can’t, your hips either sag towards the floor or pike up towards the ceiling.',
      },
      { h2: 'What good looks like' },
      {
        p: 'Picture a straight line from your ears through your shoulders, hips, knees and ankles. Your ribs are pulled down, your glutes are squeezed, and your neck is neutral, with your eyes on the floor just ahead of your hands.',
      },
      { h2: 'Set up your hands and elbows' },
      {
        p: 'Place your hands under your shoulders or slightly wider, with your fingers spread. As you lower, let your elbows point back at about 45 degrees from your body instead of flaring straight out to the sides. Most people find it easier on the shoulders, and it makes the straight line easier to hold.',
      },
      { h2: 'Why your hips sag' },
      {
        ul: [
          'Your core tires before your arms do, often in the last few reps.',
          'You never braced in the first place.',
          'Your glutes are switched off, so your pelvis tips forward.',
          'The variation is too hard for now.',
        ],
      },
      { h2: 'Why your hips pike up' },
      {
        p: 'Lifting your hips shifts weight off your arms and makes the push-up easier, which is why it creeps in when you’re tired. It also reduces how much your chest works.',
      },
      { h2: 'How to fix it' },
      {
        ol: [
          '**Brace before every rep.** Squeeze your glutes, pull your ribs down and tighten your stomach as if you’re about to be poked.',
          '**Raise your hands.** Push-ups against a bench or table take weight off your arms and core so you can own the position. Lower the surface as you get stronger.',
          '**Practise the plank.** Three holds of 20 to 30 seconds with perfect form, a few times a week, build the endurance your push-ups need.',
          '**Do fewer, cleaner reps.** End the set when your hips start to move rather than grinding out ugly reps.',
          '**Slow down.** Take two or three seconds to lower; control beats speed.',
        ],
      },
      { h2: 'A four-week progression' },
      {
        ul: [
          '**Week 1:** push-ups against a kitchen counter, 3 sets of 8 to 12, with a one-second pause at the bottom.',
          '**Week 2:** a lower surface, such as a sturdy bench or a step.',
          '**Week 3:** lower again, or stay at the same height and take three seconds to lower on every rep.',
          '**Week 4:** start with a set on the floor, then finish your sets with your hands raised. A straight line matters more than the height of your hands.',
        ],
      },
      { h2: 'Core exercises that help' },
      {
        ul: [
          '**Plank:** 3 holds of 20 to 30 seconds, stopping as soon as your line breaks. See [how long to hold a plank](/articles/how-long-to-hold-a-plank).',
          '**Side plank:** 2 holds of 15 to 30 seconds on each side, knees down if you need to.',
          '**Dead bug:** lie on your back with your arms pointing up and your knees above your hips. Slowly lower the opposite arm and leg towards the floor while your lower back stays down. 2 sets of 6 to 8 on each side.',
        ],
      },
      { h2: 'What about knee push-ups?' },
      {
        p: 'Knee push-ups are fine, and the same rule applies: a straight line, this time from your head to your knees. Many people find that raised-hand push-ups teach the full position better, because your legs and hips work just as they will on the floor.',
      },
      { h2: 'Test yourself' },
      {
        p: 'Film a set side-on, or set your phone on the floor to the side of you during a TRACK AI push-up or plank set. The coach calls out **“Hips sagging”** or **“Hips too high”** the moment your line breaks, and in a plank the timer pauses while your hips sag.',
      },
      { tip: 'See the [push-up guide](/guides/pushup) and the [plank guide](/guides/plank) for step-by-step technique and easier and harder versions.' },
    ],
  },
  {
    slug: 'lunge-balance-and-depth',
    title: 'Wobbly, shallow lunges? How to fix your balance and depth',
    summary: 'How to stop wobbling in lunges: the right stance width, forward versus reverse lunges, and how to get deep enough for every rep to count.',
    published: '2026-09-30',
    about: ['lunge'],
    blocks: [
      {
        p: 'Lunges train each leg on its own, which makes them brilliant for strength and balance, and also makes them wobbly. If you tip sideways, rush into the bottom or stop halfway down, you’re in good company. Most of it comes down to your stance and your speed.',
      },
      { h2: 'Train tracks, not a tightrope' },
      {
        p: 'The most common cause of wobbling is a stance that’s too narrow. If your front and back feet land in one line, as if on a tightrope, you have almost no base to balance on. Keep your feet about hip-width apart as you step, as if each foot were on its own rail of a train track.',
      },
      { h2: 'Forward, reverse or split squat?' },
      {
        ul: [
          '**Split squat:** your feet stay where they are and you simply go down and up. It’s the easiest version to balance and the best place to start.',
          '**Reverse lunge:** you step backwards into the lunge. Your front foot stays planted, which makes it steadier, and many people find it kinder to their knees.',
          '**Forward lunge:** you step forwards and push back to the start. Stopping your body as your foot lands makes it the hardest to control.',
          '**Walking lunge:** step after step across the room. Great once your balance is solid.',
        ],
      },
      { h2: 'How deep should you go?' },
      {
        p: 'Lower until your back knee nearly touches the floor, with both knees bent to about 90 degrees at the bottom. If you can’t get that deep with control yet, use a split squat, hold a chair, or put a cushion under your back knee as a depth target. A half-depth lunge trains half the range.',
      },
      { h2: 'Five fixes for a steadier lunge' },
      {
        ol: [
          '**Widen your stance** to hip-width, as above.',
          '**Slow down.** Take two or three seconds to lower. Dropping into the bottom is where balance gets lost.',
          '**Stay tall.** Keep your torso stacked over your hips; leaning forward shifts your weight over your front toes.',
          '**Grip the floor** with your front foot, keeping your weight over the middle of the foot and your front knee in line with your second toe.',
          '**Hold on while you learn.** A hand on a wall or the back of a chair is not cheating. Use less support as you get steadier.',
        ],
      },
      { h2: 'Watch your front knee' },
      {
        p: 'As in a squat, your front knee can drift inward as you push up. Keep it pointing the same way as your toes. [Knees caving in](/articles/knees-caving-in-squat) has cues and drills that help with lunges too.',
      },
      { h2: 'Sets and reps' },
      {
        p: 'Try 3 sets of 8 to 10 reps on each leg, starting with your weaker side. Once 12 steady reps feel easy, hold dumbbells or a backpack, or move on to a harder version such as the walking lunge. [Progressive overload at home](/articles/progressive-overload-at-home) shows the full ladder.',
      },
      { h2: 'What the coach checks' },
      {
        p: 'Side-on at hip height, the TRACK AI coach judges your depth and posture: it calls out **“Too shallow”**, **“Could go deeper”**, **“Leaning forward”** and **“Rushing”**. Facing the camera, it watches your front knee and calls out **“Knee caving in”**.',
      },
      { tip: 'Read the [lunge guide](/guides/lunge) for step-by-step technique and easier and harder versions.' },
    ],
  },
  {
    slug: 'romanian-deadlift-hinge',
    title: 'How to hinge: learning the Romanian deadlift',
    summary: 'The hip hinge explained: how a Romanian deadlift differs from a squat, how to keep your back flat, and three drills to learn the movement at home.',
    published: '2026-09-30',
    about: ['rdl'],
    blocks: [
      {
        p: 'Picking a box up from the floor, closing a car door with your hip, leaning over a sink: all of them use a hip hinge. The Romanian deadlift (RDL) trains that pattern with weight, and it’s one of the best exercises for your hamstrings, your glutes and the muscles along your spine. It’s also often misunderstood, because it looks a bit like a squat. It isn’t one.',
      },
      { h2: 'Hinge versus squat' },
      {
        p: 'In a squat, your hips and knees bend together and your hips travel down. In a hinge, your hips travel back while your knees keep a soft, fixed bend, and your chest tips forward as a result. If your knees keep bending as you go down, you’re squatting the weight, and your thighs take over from your hamstrings.',
      },
      { h2: 'How to do it' },
      {
        ol: [
          'Stand tall holding dumbbells or a backpack in front of your thighs, feet hip-width apart.',
          'Unlock your knees slightly. That bend stays the same for the whole rep.',
          'Push your hips back as if you were closing a door behind you with your bottom. The weights slide down close to your legs.',
          'Keep your back flat and your chest proud. Go down until you feel a strong stretch in your hamstrings, usually with the weights around knee height or a little lower.',
          'Drive your hips forward to stand tall, squeezing your glutes at the top. Don’t lean back.',
        ],
      },
      { h2: 'Keeping your back flat' },
      {
        p: 'The most important rule of the RDL is that your back stays in the same neutral position from top to bottom. Your range ends where your back would start to round, not where the weights touch the floor. For most people that’s somewhere between just below the knee and mid-shin. That’s normal, and it grows as your hamstrings get used to the stretch.',
      },
      { h2: 'Three drills to learn the hinge' },
      {
        ol: [
          '**Wall touch.** Stand about a foot’s length in front of a wall, facing away from it. Push your hips back to touch the wall, then stand up. Move a little further away as it gets easier.',
          '**Broomstick hinge.** Hold a broomstick along your back so it touches your head, upper back and tailbone. Hinge forward while keeping all three points in contact.',
          '**Hands-on-hips hinge.** Put your hands in the crease of your hips and push them back as you bend forward. You should feel your hips fold.',
        ],
      },
      { h2: 'Common mistakes' },
      {
        ul: [
          '**Bending forward instead of back.** The first move is your hips going back, not your chest going down.',
          '**Rounding your back** to reach lower. Stop where your back stays flat.',
          '**Squatting the weight,** with your knees bending more and more.',
          '**Not finishing tall.** Stand fully upright at the top, with your hips through.',
          '**Dropping into the bottom.** Take about two seconds to lower; the stretch is where much of the work happens.',
        ],
      },
      { h2: 'Sets, reps and weight' },
      {
        p: 'Start light, with a backpack or a pair of dumbbells, and do 3 sets of 10 to 12 slow reps. Your hamstrings will probably feel it the next day, especially the first time. Add weight gradually, and only while your back stays flat on every rep.',
      },
      { h2: 'What the coach checks' },
      {
        p: 'Side-on at hip height, the TRACK AI coach can see your hinge. It calls out **“Back rounding”** and **“Squatting it”** from that view, **“Hips not going back”** when you bend forward instead of back, and **“Not hinging far enough”**, **“Not finishing tall”** or **“Lowering too fast”** when the range or tempo is off.',
      },
      { tip: 'Read the [Romanian deadlift guide](/guides/rdl) for step-by-step technique and easier and harder versions. If you have back pain, check with a physiotherapist or doctor before you load this movement.' },
    ],
  },
  {
    slug: 'shoulder-press-leaning-back',
    title: 'Leaning back in the shoulder press? How to press straight up',
    summary: 'Why your lower back arches when you press overhead, and how to brace, stand and choose a weight so the press stays in your shoulders.',
    published: '2026-09-30',
    about: ['press'],
    blocks: [
      {
        p: 'The standing shoulder press is one of the best upper-body exercises there is: it trains your shoulders and triceps, and your core has to hold you upright while the weight goes overhead. But as the weight gets heavy, many people lean back to make the press easier. A big arch turns it into something closer to an incline chest press and puts stress on your lower back that it doesn’t need.',
      },
      { h2: 'What a good press looks like' },
      {
        ul: [
          'Feet about hip-width apart, knees straight but not locked, glutes squeezed.',
          'The weights start at shoulder height, with your forearms vertical and your wrists stacked over your elbows.',
          'You press straight up and finish with your arms straight, the weights over your shoulders and your biceps close to your ears.',
          'Your ribs stay down and your body stays in one vertical line from your head to your heels.',
        ],
      },
      { h2: 'Why you lean back' },
      {
        ul: [
          '**The weight is too heavy,** so you recruit your chest by tipping backwards.',
          '**Your core isn’t braced,** so your lower back arches as your arms go up.',
          '**Stiff shoulders or upper back** stop your arms going straight overhead, and your lower back makes up the difference.',
          '**Fatigue** in the last reps of a set.',
        ],
      },
      { h2: 'How to fix it' },
      {
        ol: [
          '**Squeeze your glutes** before every rep. It tucks your pelvis under and makes arching much harder.',
          '**Brace your abs** as if someone is about to poke you in the stomach, and keep your ribs pulled down.',
          '**Move your head, not your spine.** Tuck your chin slightly as the weights pass your face, then bring your head through once they’re overhead.',
          '**Use a lighter weight** for a few weeks and own every rep.',
          '**Try a split stance.** With one foot slightly in front of the other, leaning back feels unstable, so you notice it straight away.',
          '**Sit down.** A seated press on a bench with a back support takes the arch out while you work on it.',
        ],
      },
      { h2: 'Finish every rep' },
      {
        p: 'Two other common faults are stopping partway up and finishing with soft, bent elbows. Lock out each rep with straight arms directly over your shoulders. If your arms won’t go straight overhead without your back arching, that’s a mobility limit rather than a strength one: work in the range you can control, and if pressing overhead hurts your shoulder, stop and get it checked.',
      },
      { h2: 'Uneven arms' },
      {
        p: 'Most people have a stronger side. If one arm lags, let the weaker side set the pace: both arms go up together, and the set ends when the weaker arm can’t do a clean rep. Pressing one arm at a time for a few weeks also helps even things out.',
      },
      { h2: 'Sets, reps and a starting weight' },
      {
        p: 'Start with a weight you could press about 12 to 15 times, and do 3 sets of 8 to 12. Add weight only when all your sets are clean. With dumbbells, the jump to the next size can be big, so add reps before you add weight.',
      },
      { h2: 'What the coach checks' },
      {
        p: 'Facing the camera, the TRACK AI coach compares your arms and calls out **“Uneven arms”** when one side lags. From the side, it spots **“Leaning back”**. From either view it notices a **“Partial press”** or a **“Soft lockout”**.',
      },
      { tip: 'Read the [shoulder press guide](/guides/press) for step-by-step technique and easier and harder versions.' },
    ],
  },
  {
    slug: 'bicep-curl-swinging',
    title: 'Stop swinging your bicep curls: how to curl with strict form',
    summary: 'Why curls turn into swings, and how to keep your elbows still, use the full range and pick a weight that actually trains your biceps.',
    published: '2026-09-30',
    about: ['curl'],
    blocks: [
      {
        p: 'The bicep curl looks like the simplest exercise there is, which is exactly why it’s so often done badly. The weight is a little too heavy, the hips start to rock, the elbows drift forward, and suddenly your back and shoulders are doing the lifting. Strict curls with a lighter weight train your biceps far better than heavy swings.',
      },
      { h2: 'What a good curl looks like' },
      {
        ul: [
          'You stand tall with your feet hip-width apart, knees soft and core braced.',
          'Your upper arms stay by your sides, with your elbows close to your ribs.',
          'Only your forearms move: you curl until your forearm is close to your upper arm, squeeze, and lower until your arms are straight.',
          'The lowering takes a second or two. You control the weight all the way down.',
        ],
      },
      { h2: 'Why curls turn into swings' },
      {
        ul: [
          '**The weight is too heavy.** If you need to lean back to get it moving, the weight is choosing your technique for you.',
          '**Chasing reps.** The last reps of a set are hard, so your body finds an easier way to finish them.',
          '**Nobody is watching.** Small swings are hard to notice from the inside, especially when you’re tired.',
        ],
      },
      { h2: 'Five ways to fix it' },
      {
        ol: [
          '**Drop the weight by about a third** and do your reps slowly. If you can’t do 8 strict reps, it’s too heavy.',
          '**Pin your elbows.** Imagine your elbows are stuck to your sides. Only your forearms move.',
          '**Brace as if you’re about to be pushed.** Tighten your stomach and squeeze your glutes so your torso stays still.',
          '**Stand against a wall.** With your back and head touching a wall, swinging becomes almost impossible. It’s a great way to learn how a strict curl feels.',
          '**Lower for two seconds.** Controlling the lowering keeps tension on your biceps and takes away the bounce that starts the next swing.',
        ],
      },
      { h2: 'Use the full range' },
      {
        p: 'Half reps are the other common curl fault. Stopping short at the top misses the squeeze at the end of the curl, and stopping short at the bottom skips the stretch. Straighten your arms at the bottom of every rep and curl all the way up at the top. If you can’t, the weight is too heavy.',
      },
      { h2: 'How many sets and reps?' },
      {
        p: 'Curls work well with moderate weights and higher reps: 2 or 3 sets of 10 to 15, finishing each set with one or two good reps in the tank. Your biceps also work in pulling exercises such as rows, so a couple of sets of curls on top is usually plenty. See [how many sets and reps](/articles/sets-and-reps) for the bigger picture.',
      },
      { h2: 'Together or alternating?' },
      {
        p: 'Both work. Curling both arms at once is quicker and makes a swing easier to spot. Alternating arms lets you focus on one side at a time, but it’s easier to twist your torso, so keep your shoulders square to the front.',
      },
      { h2: 'No dumbbells?' },
      {
        p: 'Fill two water bottles or a backpack, or stand on a resistance band and hold the ends. Anything you can hold with your palms facing up works, as long as you can control it.',
      },
      { h2: 'What the coach checks' },
      {
        p: 'Facing your phone at chest height, the TRACK AI coach watches both arms. It calls out **“Swinging”** when your torso starts to rock, **“Elbows drifting”** when your upper arms move, and **“Half rep”** or **“Not extending fully”** when you cut the range short. It also notices when you are **“Dropping the weight”** instead of lowering it.',
      },
      { tip: 'Read the [bicep curl guide](/guides/curl) for step-by-step technique and easier and harder versions.' },
    ],
  },
  {
    slug: 'how-long-to-hold-a-plank',
    title: 'How long should you hold a plank?',
    summary: 'Why good form beats long holds, how long to hold a plank at each level, and how to make it harder without holding it for minutes.',
    published: '2026-09-30',
    about: ['plank'],
    blocks: [
      {
        p: 'The plank is a simple test: hold your body in a straight line and don’t let it sag. It trains your core to resist movement, which is what it does when you carry shopping, lift a box or hold your position in a push-up. So how long should you hold it? The honest answer: only as long as your form holds.',
      },
      { h2: 'The short answer' },
      {
        p: 'For most people, **2 to 4 holds of 20 to 60 seconds** with good form are more useful than one long, shaky hold. Once you can hold a clean plank for about a minute, make it harder instead of longer.',
      },
      { h2: 'Why longer isn’t always better' },
      {
        p: 'In a long hold, the last part is often the worst part: your hips sag, your lower back takes the strain and your shoulders creep up towards your ears. Those seconds count on a stopwatch, but they don’t train the position you’re after. Several shorter holds with rests in between let you spend more total time in good form.',
      },
      { h2: 'Good plank form' },
      {
        ul: [
          'Elbows under your shoulders (forearm plank) or hands under your shoulders (high plank).',
          'A straight line from your head through your shoulders, hips and knees to your heels.',
          'Glutes squeezed, stomach tight, ribs pulled down.',
          'Head in line with your spine, eyes on the floor just in front of your hands.',
          'Steady breathing. If you have to hold your breath, the hold is too hard for now.',
        ],
      },
      { h2: 'How long at each level' },
      {
        ul: [
          '**Just starting:** 3 holds of 10 to 20 seconds, knees down if needed.',
          '**Getting there:** 3 holds of 20 to 40 seconds on your toes.',
          '**Comfortable:** 3 holds of 45 to 60 seconds, then move on to a harder variation.',
        ],
      },
      { h2: 'Make it harder, not longer' },
      {
        ul: [
          '**Squeeze harder.** Pull your elbows towards your toes and squeeze your glutes as hard as you can for 10 seconds. It’s surprisingly tough.',
          '**Lift a foot.** Raise one foot a few centimetres for a few seconds, then switch, keeping your hips level.',
          '**Shoulder taps.** In a high plank, tap each shoulder in turn without letting your hips rock.',
          '**Side plank.** Train the sides of your core, knees down or feet stacked.',
          '**Feet raised.** Put your feet on a step to shift more of your weight onto your arms.',
        ],
      },
      { h2: 'Common mistakes' },
      {
        ul: [
          '**Hips sagging** as your core tires. End the hold, or drop to your knees for the last few seconds.',
          '**Hips too high,** which makes the plank easier by taking weight off your core.',
          '**Head dropping,** with your eyes on your feet. Look at the floor just in front of your hands.',
          '**Watching the clock.** Set a target, but stop when your form breaks.',
        ],
      },
      { h2: 'What the coach checks' },
      {
        p: 'With your phone on the floor to your side, the TRACK AI coach calls out **“Hips sagging”**, **“Hips too high”** and **“Head dropping”**. Its timer pauses while your hips sag and carries on when you lift them back into line, and your score for the hold is the share of it you spent without that major fault.',
      },
      { tip: 'Read the [plank guide](/guides/plank) for step-by-step technique, and [hips sagging in push-ups and planks](/articles/pushup-hips-sagging) for more core exercises.' },
    ],
  },
  {
    slug: 'phone-setup',
    title: 'How to set up your phone for AI form tracking',
    summary: 'Where to put your phone for each exercise, how far away to stand, and the light and clothing that help an AI coach see your body clearly.',
    published: '2026-09-30',
    blocks: [
      {
        p: 'An AI coach can only judge what the camera sees. Thirty seconds spent on your setup makes rep counting and form checks far more reliable. Here’s what matters most.',
      },
      { h2: 'Distance: two to three metres' },
      {
        p: 'Your whole body needs to be in the frame, from head to feet (or hands to heels for floor exercises). Too close and your ankles or hands get cut off, so the coach can’t see your depth. Too far and you become small in the picture, which makes the tracking less precise. Two to three metres suits most rooms.',
      },
      { h2: 'Height and orientation' },
      {
        ul: [
          'For standing exercises, prop the phone at about hip height, upright (portrait).',
          'For [push-ups](/guides/pushup) and [planks](/guides/plank), put it on the floor, side-on, ideally sideways (landscape) so your whole body fits.',
          'Keep the phone steady and roughly level. Leaning it against a water bottle or a shoe works fine.',
        ],
      },
      { h2: 'Side-on or facing the camera?' },
      {
        p: 'A side view shows depth and angles: how low your [squat](/guides/squat) goes, whether your back stays flat in a [Romanian deadlift](/guides/rdl), and whether your hips sag. A front view shows what happens left to right: knees caving in, uneven arms in a [shoulder press](/guides/press), or elbows drifting in a [curl](/guides/curl). Each exercise’s setup screen in TRACK AI tells you which view it prefers.',
      },
      { h2: 'Setup for each exercise' },
      {
        ul: [
          '**[Squat](/guides/squat):** side-on, phone at about hip height, 2 to 3 metres away. Face the camera instead to check your knees.',
          '**[Push-up](/guides/pushup):** phone on the floor about 2 metres to your side, in landscape if you can.',
          '**[Lunge](/guides/lunge):** side-on at hip height, 2 to 3 metres away, with room to step forward or back.',
          '**[Romanian deadlift](/guides/rdl):** side-on at hip height, 2 to 3 metres away. It’s the only view that shows your hinge.',
          '**[Bicep curl](/guides/curl):** facing the camera at chest height, 1.5 to 2.5 metres away, with at least your head to your hips in view.',
          '**[Shoulder press](/guides/press):** facing the camera at chest height, 2 to 3 metres away, with room above your head for your hands.',
          '**[Jumping jacks](/guides/jumping_jack):** facing the camera, 2.5 to 3 metres away, with room for your arms overhead and your feet out wide.',
          '**[Plank](/guides/plank):** phone on the floor about 2 metres to your side, in landscape, with your head to your heels in the frame.',
        ],
      },
      { h2: 'Light' },
      {
        p: 'Use even light from in front of you or from the side. The most common problem is a bright window behind you, which turns you into a silhouette. At night, switch on a main room light rather than relying on one lamp.',
      },
      { h2: 'Clothing and background' },
      {
        p: 'Fitted clothes that contrast with the background help the camera find your joints; a baggy hoodie can hide your hips and elbows. Clear the floor around you, and make sure you’re the only person in the frame.',
      },
      { h2: 'Troubleshooting' },
      {
        ul: [
          '**“Step back so your whole body fits in the frame”:** move further away, or tilt the phone so there’s space above your head and below your feet.',
          '**Reps aren’t counting:** make sure each rep reaches full depth and full lockout, and hold still for a second at the start so the coach can calibrate to you.',
          '**The tracking looks jumpy:** add light in front of you, and move anything behind you that could look like a person, such as a coat on a door.',
          '**You can’t hear the coach:** turn the volume up and check your phone isn’t on silent or in a focus mode.',
        ],
      },
      { h2: 'Quick checklist' },
      {
        ul: [
          'Whole body visible, with a little space around you.',
          'Phone stable, at hip height or on the floor for floor exercises.',
          'Light in front of you, not behind.',
          'Fitted clothes, clear floor.',
          'Volume up: the coach talks to you.',
          'Hold still for a second at the start so it can calibrate to your body.',
        ],
      },
      { tip: 'Ready? [Pick an exercise](/) and start a set. The coach guides you into position before the first rep.' },
    ],
  },
  {
    slug: 'how-ai-form-tracking-works',
    title: 'How AI form tracking works',
    summary: 'How TRACK AI turns a phone camera into a coach: body tracking, joint angles, rep counting, form checks and scores, and why your video never leaves your device.',
    published: '2026-09-30',
    blocks: [
      {
        p: 'TRACK AI uses nothing but your phone’s camera: no wearables, no sensors, no special equipment. Here is what happens between you starting a set and the coach telling you to sit deeper.',
      },
      { h2: '1. Finding your body' },
      {
        p: 'Each camera frame goes through a body-tracking model, Google’s MediaPipe Pose Landmarker, that finds 33 points on your body: shoulders, elbows, wrists, hips, knees, ankles, heels, toes and more. It estimates where each point is in the picture and in 3D, up to about thirty times a second on most phones.',
      },
      { h2: '2. Smoothing and calibration' },
      {
        p: 'Raw tracking jitters slightly from frame to frame, so the points are smoothed with a filter that stays steady when you’re still but keeps up when you move fast. When you hold still before your first rep, the coach also learns which way is up (in case your phone is tilted) and what your start position looks like.',
      },
      { h2: '3. Measuring the movement' },
      {
        p: 'From those points the coach measures what matters for each exercise: the angle of your knees and hips in a [squat](/guides/squat), how far your hips travel back in a [Romanian deadlift](/guides/rdl), your elbow angle in a [curl](/guides/curl), or the line from your shoulders to your ankles in a [plank](/guides/plank). It also works out whether it’s seeing you from the side, the front or an angle, and only checks what that view can reliably show.',
      },
      { h2: '4. Counting reps' },
      {
        p: 'A rep counts when you move from your start position to the target depth and back again. Half reps don’t count, and small wobbles at the top or bottom can’t trigger a double count. That’s why the numbers match what a strict coach would count.',
      },
      { h2: '5. Checking your form' },
      {
        p: 'Each exercise has its own form rules: knees caving in, back rounding, hips sagging, swinging the weight, leaning back in a press, and more. The coach only flags a fault when it sees it consistently, not on a single noisy frame, so it corrects you without nagging.',
      },
      { h2: '6. Coaching you out loud' },
      {
        p: 'Cues are spoken by your device’s own voice: short corrections like “Chest up!”, rep counts, and encouragement when you fix something. Important corrections jump the queue; routine counting waits its turn.',
      },
      { h2: '7. Scoring the set' },
      {
        p: 'Every rep starts with a score of 100. A minor fault takes a few points off and a major one takes off a lot more. Your form score for the set is the average of your reps, so one messy rep doesn’t ruin a good set, but a habit shows up clearly. For a plank, the score is the share of the hold you spent without a major fault. After the set, the summary tells you the one thing to work on next time.',
      },
      { h2: 'Why the camera angle matters' },
      {
        p: 'A single camera sees in two dimensions, and depth is hard to judge. From the side, the angles of your hips and knees are clear, but your knees could cave in without the picture changing much. From the front, it’s the other way round. That’s why each exercise has a recommended view, and why the coach only checks what the current view can show. [How to set up your phone](/articles/phone-setup) lists the best view for each exercise.',
      },
      { h2: 'Why your video stays private' },
      {
        p: 'All of this runs inside your browser on your own device. The camera video is never uploaded, recorded or stored, and you don’t need an account. Only your settings and workout history are saved, in your browser. The app saves itself on your first visit, and the tracking model the first time you start a set, so after that it works without a connection.',
      },
      { h2: 'What it can’t do' },
      {
        p: 'A single camera can be fooled by poor light, baggy clothes or a body part that’s out of view, and it can’t feel what you feel. Use it as a second pair of eyes, and see a professional for pain or injury.',
      },
      { tip: 'Get the best tracking with the tips in [how to set up your phone](/articles/phone-setup).' },
    ],
  },
];

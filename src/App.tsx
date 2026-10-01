import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SetResult } from './core/analyzer';
import type { ExerciseId } from './core/exercise';
import { AI_DEBRIEF_ENABLED } from './coach/debrief';
import { WebAudioSfx } from './coach/sfx';
import { NullEngine, Priority, VoiceQueue, WebSpeechEngine } from './coach/voice';
import { EXERCISE_BY_ID } from './exercises';
import { hasDemo } from './media/people';
import { addHistory, entryFromResult } from './state/history';
import { useSettings } from './state/settings';
import { History } from './ui/History';
import { Home } from './ui/Home';
import { Settings } from './ui/Settings';
import { Setup } from './ui/Setup';
import { Summary } from './ui/Summary';

/**
 * A workout with `id: null` recognises the exercise by itself (Start training on the home page);
 * one with an id is that exercise, set up first (the exercise guides link there).
 * `demoExercise` is what the demo athlete performs in a recognising demo.
 */
type Route =
  | { name: 'home' }
  | { name: 'setup'; id: ExerciseId }
  | { name: 'workout'; id: ExerciseId | null; demo: boolean; key: number; demoExercise?: ExerciseId }
  | { name: 'summary'; id: ExerciseId | null; result: SetResult; entryId: string; demo: boolean; demoExercise?: ExerciseId }
  | { name: 'history' }
  | { name: 'settings' };

// The workout screen (camera, body tracking, coach) is the biggest part of the app, so it downloads
// on demand. The setup screen fetches it ahead of time, so pressing Start is still instant.
let workoutScreen: typeof import('./ui/Workout').Workout | null = null;
let workoutLoad: Promise<void> | null = null;
function loadWorkout(): Promise<void> {
  workoutLoad ??= import('./ui/Workout').then(
    (m) => {
      workoutScreen = m.Workout;
    },
    (err: unknown) => {
      workoutLoad = null;
      throw err;
    },
  );
  return workoutLoad;
}

function useWorkoutScreen(wanted: boolean) {
  const [, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!wanted || workoutScreen) return;
    let live = true;
    loadWorkout().then(
      () => live && setLoaded(true),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [wanted]);
  return { Workout: workoutScreen, failed };
}

/** Shown while the workout screen downloads (a slow first visit) or if it can't. */
function WorkoutPending(props: { failed: boolean; demo: boolean; onBack: () => void }) {
  return (
    <main className="workout">
      <div className="overlay-center">
        <div className="card">
          {props.failed ? (
            <>
              <p style={{ fontWeight: 800, fontSize: 18 }}>Can't start the coach</p>
              <p className="muted">It didn't finish downloading. Check your connection and try again.</p>
              <button className="btn primary" onClick={() => location.reload()}>
                Try again
              </button>
              <button className="btn ghost" onClick={props.onBack}>
                Back
              </button>
            </>
          ) : (
            <>
              <div className="spinner" />
              <p style={{ fontWeight: 700 }}>{props.demo ? 'Preparing the demo…' : 'Starting the camera…'}</p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function initialRoutes(): Route[] {
  const params = new URLSearchParams(location.search);
  const demo = params.get('demo') as ExerciseId | null;
  const ex = params.get('exercise') as ExerciseId | null;
  // `?demo=lunge&auto` shows the demo athlete through exercise recognition.
  if (demo && demo in EXERCISE_BY_ID && params.has('auto')) {
    return hasDemo(demo) ? [{ name: 'home' }, { name: 'workout', id: null, demo: true, demoExercise: demo, key: 0 }] : [{ name: 'home' }];
  }
  if (demo && demo in EXERCISE_BY_ID) {
    const setup: Route[] = [{ name: 'home' }, { name: 'setup', id: demo }];
    return hasDemo(demo) ? [...setup, { name: 'workout', id: demo, demo: true, key: 0 }] : setup;
  }
  if (ex && ex in EXERCISE_BY_ID) return [{ name: 'home' }, { name: 'setup', id: ex }];
  // Deep link straight to the history screen.
  if (params.get('view') === 'history') return [{ name: 'home' }, { name: 'history' }];
  return [{ name: 'home' }];
}

export function App() {
  const [settings, updateSettings] = useSettings();
  const services = useMemo(() => {
    const engine = new WebSpeechEngine(settings.voiceName);
    const voice = new VoiceQueue(engine.available ? engine : new NullEngine());
    return { engine, voice, sfx: new WebAudioSfx() };
    // Services live for the whole session; settings are synced below.
  }, []);

  useEffect(() => {
    services.voice.muted = !settings.voice;
    if (!settings.voice) services.voice.clear();
    services.engine.rate = settings.speechRate;
    if (services.engine.available) services.engine.setVoice(settings.voiceName);
  }, [services, settings.voice, settings.speechRate, settings.voiceName]);

  // Screen stack mirrored into browser history so the Android/iOS back gesture works.
  const [stack, setStack] = useState<Route[]>(initialRoutes);
  const stackRef = useRef(stack);
  stackRef.current = stack;
  useEffect(() => {
    if (history.state?.depth === undefined) {
      history.replaceState({ depth: 0 }, '');
      for (let i = 1; i < stackRef.current.length; i++) history.pushState({ depth: i }, '');
    }
    const onPop = (e: PopStateEvent) => {
      const depth = typeof e.state?.depth === 'number' ? e.state.depth : 0;
      setStack((s) => s.slice(0, Math.max(1, depth + 1)));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const push = useCallback((r: Route) => {
    history.pushState({ depth: stackRef.current.length }, '');
    setStack((s) => [...s, r]);
  }, []);
  const replace = useCallback((r: Route) => setStack((s) => [...s.slice(0, -1), r]), []);
  const back = useCallback(() => history.back(), []);
  const home = useCallback(() => {
    const n = stackRef.current.length - 1;
    if (n > 0) history.go(-n);
  }, []);

  const route = stack[stack.length - 1];
  useEffect(() => window.scrollTo(0, 0), [route]);
  const { Workout, failed: workoutFailed } = useWorkoutScreen(route.name === 'setup' || route.name === 'workout' || route.name === 'summary');

  const unlockAudio = () => {
    services.engine.unlock();
    services.sfx.unlock();
  };

  const targetFor = (id: ExerciseId) => settings.targets[id] ?? EXERCISE_BY_ID[id].defaultTarget;

  switch (route.name) {
    case 'home':
      return (
        <Home
          onStart={() => {
            unlockAudio();
            push({ name: 'workout', id: null, demo: false, key: Date.now() });
          }}
          onHistory={() => push({ name: 'history' })}
          onSettings={() => push({ name: 'settings' })}
        />
      );

    case 'setup': {
      const ex = EXERCISE_BY_ID[route.id];
      return (
        <Setup
          exercise={ex}
          target={targetFor(route.id)}
          facingMode={settings.facingMode}
          onTarget={(n) => updateSettings({ targets: { ...settings.targets, [route.id]: n } })}
          onFacing={(facingMode) => updateSettings({ facingMode })}
          onStart={(demo) => {
            unlockAudio();
            push({ name: 'workout', id: route.id, demo, key: Date.now() });
          }}
          onBack={back}
        />
      );
    }

    case 'workout': {
      if (!Workout) return <WorkoutPending failed={workoutFailed} demo={route.demo} onBack={back} />;
      // Recognised exercises run as open sets: the coach counts until you stop.
      const target = route.id ? targetFor(route.id) : 0;
      const id = route.id;
      return (
        <Workout
          key={route.key}
          exercise={id ? EXERCISE_BY_ID[id] : null}
          demoExercise={route.demoExercise}
          target={target > 0 ? target : null}
          demo={route.demo}
          settings={settings}
          voice={services.voice}
          sfx={services.sfx}
          onToggleVoice={() => updateSettings({ voice: !settings.voice })}
          onExit={back}
          onDemoInstead={id && hasDemo(id) ? () => replace({ name: 'workout', id, demo: true, key: Date.now() }) : undefined}
          onFinish={(result, demo) => {
            const entry = entryFromResult(result, demo);
            const didSomething = result.reps.length > 0 || result.partialReps.length > 0 || result.holdMs > 3000;
            if (didSomething) addHistory(entry);
            replace({ name: 'summary', id, result, entryId: entry.id, demo, demoExercise: route.demoExercise });
          }}
        />
      );
    }

    case 'summary':
      return (
        <Summary
          result={route.result}
          entryId={route.entryId}
          aiDebrief={settings.aiDebrief && AI_DEBRIEF_ENABLED}
          voice={services.voice}
          onAgain={() => {
            unlockAudio();
            replace({ name: 'workout', id: route.id, demo: route.demo, demoExercise: route.demoExercise, key: Date.now() });
          }}
          onHome={home}
          onHistory={() => push({ name: 'history' })}
        />
      );

    case 'history':
      return <History onBack={back} />;

    case 'settings':
      return (
        <Settings
          settings={settings}
          onChange={updateSettings}
          onBack={back}
          onTestVoice={() => {
            unlockAudio();
            services.voice.muted = false;
            services.voice.speak("Hi! I'm your TRACK AI coach. Knees out, chest up — let's get to work!", {
              priority: Priority.urgent,
              interrupt: true,
            });
            services.voice.muted = !settings.voice;
          }}
        />
      );
  }
}

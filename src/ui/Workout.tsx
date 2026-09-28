import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { summarizeSet, WorkoutAnalyzer, type AnalyzerEvent, type AnalyzerSnapshot, type AnalyzerStatus, type SetResult } from '../core/analyzer';
import type { ExerciseDef, Phase, Severity } from '../core/exercise';
import type { View } from '../core/frame';
import type { PoseInput } from '../core/landmarks';
import { Coach, type CoachLine, type Tone } from '../coach/coach';
import type { WebAudioSfx } from '../coach/sfx';
import type { VoiceQueue } from '../coach/voice';
import { CameraError, startCamera, stopCamera } from '../pose/camera';
import { defaultQuality, getDetector, type LoadProgress, type PoseDetector } from '../pose/detector';
import { drawDemoBackdrop, drawSkeleton } from '../pose/draw';
import { ScreenWakeLock } from '../pose/wakeLock';
import { defaultCamera, demoScript, simulate, type SimFrame } from '../sim/simulator';
import type { Settings } from '../state/settings';
import { IconAlert, IconCheck, IconClose, IconCoach, IconMute, IconSound } from './icons';

export interface WorkoutProps {
  exercise: ExerciseDef;
  /** Reps or seconds; null = open-ended. */
  target: number | null;
  demo: boolean;
  settings: Settings;
  voice: VoiceQueue;
  sfx: WebAudioSfx | null;
  onToggleVoice: () => void;
  onFinish: (result: SetResult, demo: boolean) => void;
  onExit: () => void;
  onDemoInstead: () => void;
}

interface Hud {
  status: AnalyzerStatus;
  hint: string | null;
  view: View | null;
  reps: number;
  progress: number;
  phase: Phase;
  faults: { title: string; severity: Severity }[];
  holdSec: number;
  holding: boolean;
  line: CoachLine | null;
  repTones: Tone[];
  flash: Tone | null;
  go: boolean;
}

const INITIAL_HUD: Hud = {
  status: 'searching',
  hint: 'Starting…',
  view: null,
  reps: 0,
  progress: 0,
  phase: 'start',
  faults: [],
  holdSec: 0,
  holding: false,
  line: null,
  repTones: [],
  flash: null,
  go: false,
};

type Load = { state: 'loading'; message: string; fraction: number | null } | { state: 'running' } | { state: 'error'; message: string; canRetry: boolean };

const VIEW_NAME: Record<View, string> = { side: 'Side view', front: 'Front view', diagonal: 'Angled view' };

function useStageSize(ref: RefObject<HTMLDivElement | null>, aspect: number) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const W = el.clientWidth;
      const H = el.clientHeight;
      let w = W;
      let h = W / aspect;
      if (h > H) {
        h = H;
        w = H * aspect;
      }
      setSize({ w: Math.round(w), h: Math.round(h) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, aspect]);
  return size;
}

function loadMessage(p: LoadProgress): { message: string; fraction: number | null } {
  if (p.stage === 'model') return { message: 'Downloading the AI body-tracking model…', fraction: p.fraction };
  if (p.stage === 'init') return { message: 'Warming up the AI…', fraction: null };
  return { message: 'Loading the AI engine…', fraction: null };
}

const toneOf = (faults: { severity: Severity }[]): Tone =>
  faults.length === 0 ? 'good' : faults.some((f) => f.severity === 'major') ? 'bad' : 'warn';

export function Workout(props: WorkoutProps) {
  const { exercise, target, demo, settings, voice, sfx } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const finishRef = useRef<() => void>(() => {});
  const [aspect, setAspect] = useState(() => {
    const cam = defaultCamera(exercise.id);
    return demo ? cam.width / cam.height : 9 / 16;
  });
  const stage = useStageSize(wrapRef, aspect);
  const [load, setLoad] = useState<Load>({ state: 'loading', message: demo ? 'Preparing the demo…' : 'Starting the camera…', fraction: null });
  const [hud, setHud] = useState<Hud>(INITIAL_HUD);
  // `?debug` shows live pipeline stats — handy when tuning on a real phone.
  const debug = useMemo(() => new URLSearchParams(location.search).has('debug'), []);
  const [stats, setStats] = useState<string>('');
  const [attempt, setAttempt] = useState(0);
  const mirror = !demo && settings.facingMode === 'user';
  // The session outlives renders; read callbacks through a ref so they're never stale.
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    let disposed = false;
    let handle = 0;
    let stream: MediaStream | null = null;
    let detector: PoseDetector | null = null;
    let demoFrames: SimFrame[] | null = null;
    let demoStart = 0;
    let lastVideoTime = -1;
    let finishAt: number | null = null;
    let lastActiveAt = performance.now();
    let hudState: Hud = INITIAL_HUD;
    let lastHudAt = 0;
    let goUntil = 0;
    let flash: { tone: Tone; until: number } | null = null;
    let aspectNow = aspect;
    const repTones: Tone[] = [];
    let statFrames = 0;
    let statDetectMs = 0;
    let statSince = performance.now();
    const video = videoRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const wake = new ScreenWakeLock();
    const analyzer = new WorkoutAnalyzer(exercise);
    let latestLine: CoachLine | null = null;
    const coach = new Coach(exercise, {
      target,
      voice,
      sfx: settings.sfx ? sfx : null,
      onLine: (line) => {
        latestLine = line;
      },
    });
    const startedAt = Date.now();

    const stopLoop = () => {
      if ('cancelVideoFrameCallback' in video && handle) video.cancelVideoFrameCallback(handle);
      cancelAnimationFrame(handle);
      handle = 0;
    };

    const dispose = () => {
      disposed = true;
      stopLoop();
      stopCamera(stream, video);
      stream = null;
      void wake.disable();
    };

    const finish = () => {
      if (disposed) return;
      const result = summarizeSet(analyzer, { startedAt, endT: performance.now(), target });
      dispose();
      propsRef.current.onFinish(result, demo);
    };
    finishRef.current = finish;

    const schedule = () => {
      if (disposed) return;
      if (!demoFrames && 'requestVideoFrameCallback' in video) handle = video.requestVideoFrameCallback(() => step());
      else handle = requestAnimationFrame(() => step());
    };

    const draw = (s: AnalyzerSnapshot, now: number) => {
      if (canvas.width === 0) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (demoFrames) drawDemoBackdrop(ctx, s.frame);
      if (s.frame && (settings.showSkeleton || demoFrames)) {
        drawSkeleton(ctx, s.frame, { faultJoints: new Set(s.faultJoints), avatar: !!demoFrames, pulse: (now % 800) / 800 });
      }
    };

    const updateHud = (s: AnalyzerSnapshot, events: AnalyzerEvent[], now: number) => {
      for (const e of events) {
        if (e.type === 'ready') goUntil = now + 1400;
        if (e.type === 'rep') {
          const tone = toneOf(e.rep.faults);
          repTones.push(tone);
          flash = { tone, until: now + 650 };
        }
        if (e.type === 'fault' && !e.midRep) {
          // A post-rep fault (e.g. no lockout) downgrades the last rep's dot.
          const last = analyzer.reps[analyzer.reps.length - 1];
          if (last) repTones[repTones.length - 1] = toneOf(last.faults);
        }
      }
      const next: Hud = {
        status: s.status,
        hint: s.hint,
        view: s.view,
        reps: s.reps,
        progress: Math.round(Math.min(1.3, Math.max(0, s.progress)) * 50) / 50,
        phase: s.phase,
        faults: s.activeFaults.map((f) => ({ title: f.title, severity: f.severity })),
        holdSec: Math.floor(s.holdMs / 1000),
        holding: s.holding,
        line: latestLine,
        repTones: [...repTones],
        flash: flash && flash.until > now ? flash.tone : null,
        go: goUntil > now,
      };
      const changed =
        next.status !== hudState.status ||
        next.hint !== hudState.hint ||
        next.view !== hudState.view ||
        next.reps !== hudState.reps ||
        next.phase !== hudState.phase ||
        next.holdSec !== hudState.holdSec ||
        next.holding !== hudState.holding ||
        next.line !== hudState.line ||
        next.flash !== hudState.flash ||
        next.go !== hudState.go ||
        next.repTones.length !== hudState.repTones.length ||
        next.repTones.some((tone, i) => tone !== hudState.repTones[i]) ||
        next.faults.map((f) => f.title).join() !== hudState.faults.map((f) => f.title).join() ||
        (next.progress !== hudState.progress && now - lastHudAt > 50);
      if (changed) {
        hudState = next;
        lastHudAt = now;
        setHud(next);
      }
    };

    const checkEnd = (s: AnalyzerSnapshot, now: number) => {
      if (coach.targetReached && finishAt === null) finishAt = now + (exercise.kind === 'hold' ? 2200 : 2800);
      if (finishAt !== null && now >= finishAt) return finish();
      if (s.status !== 'active') return;
      if (s.phase !== 'start' || s.holding) lastActiveAt = now;
      const didSomething = s.reps > 0 || s.holdMs > 3000;
      const patience = exercise.kind === 'hold' ? 12000 : target ? 45000 : 30000;
      if (didSomething && now - lastActiveAt > patience) finish();
    };

    const step = () => {
      if (disposed) return;
      const now = performance.now();
      let pose: PoseInput | null = null;
      let analyzed = false;
      if (demoFrames) {
        const idx = Math.floor((now - demoStart) / (1000 / 30));
        if (idx >= demoFrames.length) return finish();
        pose = demoFrames[idx].pose;
        analyzed = true;
      } else if (detector && video.readyState >= 2 && video.videoWidth > 0 && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const ar = video.videoWidth / video.videoHeight;
        if (Math.abs(ar - aspectNow) > 0.01) {
          aspectNow = ar;
          setAspect(ar);
        }
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        const t0 = performance.now();
        try {
          pose = detector.detect(video, now);
        } catch {
          pose = null;
        }
        statDetectMs += performance.now() - t0;
        analyzed = true;
      }
      if (analyzed) {
        const { events, snapshot } = analyzer.process(pose, now, aspectNow);
        coach.handle(events, snapshot, now);
        draw(snapshot, now);
        updateHud(snapshot, events, now);
        checkEnd(snapshot, now);
        statFrames++;
        if (debug && now - statSince > 1000) {
          const secs = (now - statSince) / 1000;
          setStats(
            `${(statFrames / secs).toFixed(1)} fps · detect ${(statDetectMs / Math.max(1, statFrames)).toFixed(0)} ms · ` +
              `${detector?.delegate ?? 'sim'} ${detector?.quality ?? ''} · ${snapshot.view ?? '-'} · ${snapshot.phase} ` +
              `p=${snapshot.progress.toFixed(2)} m=${snapshot.metric?.toFixed(1) ?? '-'}`,
          );
          statFrames = 0;
          statDetectMs = 0;
          statSince = now;
        }
      }
      schedule();
    };

    (async () => {
      void wake.enable();
      try {
        if (demo) {
          demoFrames = simulate({ ...demoScript(exercise.id), absentSeconds: 1.2 });
          const cam = defaultCamera(exercise.id);
          canvas.width = cam.width;
          canvas.height = cam.height;
          aspectNow = cam.width / cam.height;
          setAspect(aspectNow);
          demoStart = performance.now();
        } else {
          const quality = settings.model ?? defaultQuality();
          const camera = startCamera(video, settings.facingMode).then((s) => {
            // Track the stream as soon as it exists so a failed model load still releases it.
            stream = s;
            if (disposed) stopCamera(s, video);
            return s;
          });
          const model = getDetector(quality, (p) => {
            if (!disposed) setLoad({ state: 'loading', ...loadMessage(p) });
          });
          const [, d] = await Promise.all([camera, model]);
          detector = d;
          if (disposed) return dispose();
        }
        setLoad({ state: 'running' });
        lastActiveAt = performance.now();
        schedule();
      } catch (err) {
        if (disposed) return;
        dispose();
        const message =
          err instanceof CameraError
            ? err.message
            : `The AI model couldn't start (${(err as Error)?.message ?? 'unknown error'}). Check your connection and try again.`;
        setLoad({ state: 'error', message, canRetry: !(err instanceof CameraError && err.kind === 'insecure') });
      }
    })();

    return dispose;
    // The session is deliberately created once per mount (and per retry).
  }, [attempt]);

  const hold = exercise.kind === 'hold';
  const active = hud.status === 'active';
  const showHint = !hud.go && !!hud.hint;
  const fault = hud.faults[0];
  const targetLabel = target ? (hold ? `/${target}s` : `/${target}`) : '';
  const recommended = hud.view === exercise.camera.recommended;

  const exit = () => {
    voice.clear();
    if (hud.reps > 0 || hud.holdSec > 3) finishRef.current();
    else props.onExit();
  };

  const retry = () => {
    setLoad({ state: 'loading', message: 'Starting the camera…', fraction: null });
    setAttempt((a) => a + 1);
  };

  return (
    <div className="workout">
      <div className="stage-wrap" ref={wrapRef}>
        <div className="stage" style={{ width: stage.w, height: stage.h }}>
          <video ref={videoRef} className={mirror ? 'mirror' : undefined} playsInline muted autoPlay hidden={demo} />
          <canvas ref={canvasRef} className={mirror ? 'mirror' : undefined} />
        </div>
      </div>

      {demo && <div className="demo-tag">Demo athlete</div>}
      {debug && stats && <div className="debug-stats">{stats}</div>}

      <div className="hud">
        <div className="hud-top">
          <button className="icon-btn" onClick={exit} aria-label={hud.reps > 0 ? 'End set' : 'Close'}>
            <IconClose />
          </button>
          <div className="hud-title">
            <span>{exercise.name}</span>
            {hud.view && (
              <span className="view" style={{ color: recommended ? 'var(--good)' : 'var(--warn)' }}>
                · {VIEW_NAME[hud.view]}
              </span>
            )}
          </div>
          <button className="icon-btn" onClick={props.onToggleVoice} aria-label={settings.voice ? 'Mute coach' : 'Unmute coach'}>
            {settings.voice ? <IconSound /> : <IconMute />}
          </button>
        </div>

        <div className="hud-middle">
          {hud.go ? (
            <div className="hint ready" role="status">
              GO!
            </div>
          ) : (
            showHint && (
              <div className="hint" role="status" aria-live="polite">
                {hud.hint}
                {!active && hud.status === 'positioning' && hud.hint === 'Turn sideways to the camera' && (
                  <span className="sub">{exercise.camera.why}</span>
                )}
              </div>
            )
          )}
          {active && !hold && exercise.rep && (
            <div className={`gauge ${exercise.rep.direction}${hud.progress >= 1 ? ' hit' : ''}`} aria-hidden="true">
              <div className="fill" style={{ height: `${(Math.min(1.3, hud.progress) / 1.3) * 100}%` }} />
              <div className="mark" style={{ [exercise.rep.direction === 'down' ? 'top' : 'bottom']: `${(1 / 1.3) * 100}%` }} />
            </div>
          )}
        </div>

        <div className="hud-bottom">
          <div className="scoreboard">
            <div className={`counter${hud.flash ? ` flash-${hud.flash}` : ''}`} aria-live="off">
              {hold ? (
                <>
                  <span className="value">{hud.holdSec}</span>
                  <span className="of">{target ? `/${target}s` : 's'}</span>
                </>
              ) : (
                <>
                  <span className="value">{hud.reps}</span>
                  <span className="of">{targetLabel}</span>
                </>
              )}
            </div>
            <div className="form-state">
              {active &&
                (fault ? (
                  <div className={`fault ${fault.severity === 'major' ? 'bad' : 'warn'}`} role="alert">
                    <IconAlert /> {fault.title}
                  </div>
                ) : hold && !hud.holding ? (
                  <div className="fault">Paused — get back in position</div>
                ) : (
                  <div className="fault good">
                    <IconCheck /> {hud.reps > 0 || hud.holding ? 'Good form' : 'Ready'}
                  </div>
                ))}
            </div>
          </div>

          {hud.line && (
            <div className="caption" aria-live="polite">
              <IconCoach /> {hud.line.text}
            </div>
          )}

          {!hold && hud.repTones.length + (target ?? 0) > 0 && (
            <div className="rep-dots" aria-label={`${hud.reps} reps`}>
              {hud.repTones.map((t, i) => (
                <span key={i} className={t === 'good' ? '' : t} />
              ))}
              {target
                ? Array.from({ length: Math.max(0, target - hud.repTones.length) }, (_, i) => <span key={`t${i}`} className="todo" />)
                : null}
            </div>
          )}

          {active && (
            <div className="hud-actions">
              <button className="btn" onClick={() => finishRef.current()}>
                Finish {hold ? 'hold' : 'set'}
              </button>
            </div>
          )}
        </div>
      </div>

      {load.state === 'loading' && (
        <div className="overlay-center">
          <div className="card">
            <div className="spinner" />
            <p style={{ fontWeight: 700 }}>{load.message}</p>
            {load.fraction !== null && (
              <div className="progress" aria-hidden="true">
                <div style={{ width: `${Math.round(load.fraction * 100)}%` }} />
              </div>
            )}
            <p className="muted" style={{ fontSize: 14 }}>
              Prop your phone up and step back so your whole body is in view.
            </p>
          </div>
        </div>
      )}

      {load.state === 'error' && (
        <div className="overlay-center">
          <div className="card">
            <p style={{ fontWeight: 800, fontSize: 18 }}>Can't start the coach</p>
            <p className="muted">{load.message}</p>
            {load.canRetry && (
              <button className="btn primary" onClick={retry}>
                Try again
              </button>
            )}
            <button className="btn" onClick={props.onDemoInstead}>
              Watch the demo instead
            </button>
            <button className="btn ghost" onClick={props.onExit}>
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

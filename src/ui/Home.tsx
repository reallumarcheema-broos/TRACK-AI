import { useMemo, type ReactNode } from 'react';
import type { ExerciseId } from '../core/exercise';
import { EXERCISES } from '../exercises';
import { hasAiPeople, heroPhoto } from '../media/people';
import { FREE_WORKOUTS, PAYMENTS_ON, PRICE, useAccess } from '../pay/license';
import { detectPlatform, isStandalone } from '../pwa/install';
import { loadHistory } from '../state/history';
import { ExerciseArt } from './ExerciseArt';
import { GetAppButtons, QrCode } from './GetApp';
import { IconChart, IconCheck, IconCoach, IconHistory, IconLock, IconPlay, IconSettings, IconSpark, IconTarget, IconWave, Logo } from './icons';
import { PriceBlock, type PaywallStart } from './Paywall';

const VIEW_LABEL = { side: 'Side-on', front: 'Facing camera', diagonal: 'Angled' } as const;

const FEATURES: { icon: ReactNode; title: string; text: string }[] = [
  { icon: <IconTarget />, title: 'Counts every rep', text: "Half reps don't count" },
  { icon: <IconWave />, title: 'Real-time feedback', text: 'Form checks as you move' },
  { icon: <IconCoach />, title: 'Talks you through it', text: 'Cues, counts and a debrief' },
  { icon: <IconChart />, title: 'Tracks progress', text: 'Every set scored and saved' },
];

const STEPS = [
  { title: 'Prop it up', text: '2–3 m away, your whole body in view' },
  { title: 'Start moving', text: 'Hold still for a second, then go' },
  { title: 'Listen', text: 'Reps, cues and a debrief, out loud' },
];

/** An example trend for people who haven't trained yet (labelled as an example). */
const EXAMPLE_SCORES = [58, 64, 61, 70, 74, 72, 79, 82];

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

function Ring({ value }: { value: number }) {
  const c = 2 * Math.PI * 16;
  return (
    <svg className="ring" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="16" className="track" />
      <circle cx="20" cy="20" r="16" className="value" strokeDasharray={`${c * value} ${c}`} />
    </svg>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const lo = Math.min(...values) - 4;
  const hi = Math.max(...values) + 4;
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * 100},${36 - ((v - lo) / Math.max(1, hi - lo)) * 32}`);
  return (
    <svg className="sparkline" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts.join(' ')} />
      {pts.map((p) => {
        const [x, y] = p.split(',');
        return <circle key={p} cx={x} cy={y} r="1.6" />;
      })}
    </svg>
  );
}

/** Your own recent form scores, or a clearly labelled example before your first sets. */
function useScoreTrend(): { scores: number[]; example: boolean } {
  return useMemo(() => {
    const real = loadHistory()
      .filter((e) => !e.demo)
      .slice(0, 8)
      .map((e) => e.formScore)
      .reverse();
    return real.length >= 2 ? { scores: real, example: false } : { scores: EXAMPLE_SCORES, example: true };
  }, []);
}

/** "Try it free, then $14.99 a month" — only when payments are set up. */
function Pricing({ onPaywall }: { onPaywall: (start: PaywallStart) => void }) {
  const access = useAccess();
  return (
    <section id="pricing" className="section pricing" aria-labelledby="pricing-title">
      <div className="pricing-copy">
        <span className="eyebrow">Pricing</span>
        <h2 id="pricing-title">
          Try it free. Then {PRICE} a month.
        </h2>
        <p>
          Your first {FREE_WORKOUTS} workouts are free: no card, no account. After that, TRACK AI Pro is {PRICE} a month, and you can
          cancel anytime.
        </p>
      </div>
      <div className="price-card">
        <span className="k">TRACK AI Pro</span>
        <PriceBlock />
        {access.kind === 'subscribed' ? (
          <p className="subscribed">
            <IconCheck /> You're subscribed on this device
          </p>
        ) : (
          <div className="price-actions">
            <button className="btn primary" onClick={() => scrollTo('exercises')}>
              Start free
            </button>
            <button className="btn ghost" onClick={() => onPaywall('key')}>
              I have a license key
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export function Home(props: {
  onPick: (id: ExerciseId) => void;
  onHistory: () => void;
  onSettings: () => void;
  onPaywall: (start: PaywallStart) => void;
}) {
  const hero = heroPhoto();
  const standalone = isStandalone();
  const desktop = detectPlatform(navigator.userAgent, navigator.maxTouchPoints) === 'desktop';
  const trend = useScoreTrend();
  const latest = trend.scores[trend.scores.length - 1];
  const change = latest - trend.scores[0];

  return (
    <main className="page home">
      <header className="topbar">
        <div className="brand">
          <Logo />
          <span className="wordmark">
            TRACK AI <small>Coach</small>
          </span>
        </div>
        <nav className="nav-links" aria-label="Sections">
          <button onClick={() => scrollTo('exercises')}>Exercises</button>
          <button onClick={() => scrollTo('how')}>How it works</button>
          {PAYMENTS_ON && <button onClick={() => scrollTo('pricing')}>Pricing</button>}
          <button onClick={() => scrollTo('privacy')}>Privacy</button>
        </nav>
        <span className="spacer" />
        {!standalone && (
          <button className="btn get-app-top" onClick={() => scrollTo('get-app')}>
            Get the app
          </button>
        )}
        <button className="icon-btn" onClick={props.onHistory} aria-label="History">
          <IconHistory />
        </button>
        <button className="icon-btn" onClick={props.onSettings} aria-label="Settings">
          <IconSettings />
        </button>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">AI-powered form coach</span>
          <h1>
            Your AI trainer, <em>right in your phone.</em>
          </h1>
          <p className="lead">
            Real-time rep counting, instant form correction and a coach that talks you through every set. Just prop up
            your phone and move.
          </p>
          <div className="cta-row">
            <button className="btn primary" onClick={() => scrollTo('exercises')}>
              <IconSpark /> Start training
            </button>
            <button className="btn-play" onClick={() => scrollTo('how')}>
              <span className="play-ring">
                <IconPlay />
              </span>
              See how it works
            </button>
          </div>
          <GetAppButtons />
        </div>

        <div className="hero-visual">
          {hero ? (
            <img className="hero-photo" src={hero} alt="" />
          ) : (
            <div className="hero-art" aria-hidden="true">
              <span>Track</span>
            </div>
          )}
          <div className="float-card session" aria-hidden="true">
            <span className="k">Live set</span>
            <div className="ring-row">
              <b>
                08<small>/10</small>
              </b>
              <Ring value={0.8} />
            </div>
            <span className="k">Form</span>
            <div className="meter">
              <i style={{ width: '92%' }} />
            </div>
          </div>
          <div className="float-card tip" aria-hidden="true">
            <span className="k">
              <IconSpark /> AI tip
            </span>
            <p>Keep your chest up and push your knees out. You're doing great!</p>
          </div>
        </div>
      </section>

      <section className="feature-strip" aria-label="What the coach does">
        {FEATURES.map((f) => (
          <div className="feature" key={f.title}>
            <span className="f-icon">{f.icon}</span>
            <div>
              <b>{f.title}</b>
              <span>{f.text}</span>
            </div>
          </div>
        ))}
      </section>

      <section id="exercises" className="section" aria-labelledby="pick">
        <div className="section-head">
          <span className="eyebrow">Pick your movement</span>
          <h2 id="pick">{EXERCISES.length} moves. One coach.</h2>
        </div>
        <div className="ex-grid">
          {EXERCISES.map((ex) => (
            <button key={ex.id} className="ex-card" onClick={() => props.onPick(ex.id)}>
              <ExerciseArt id={ex.id} />
              <h3>{ex.name}</h3>
              <span className="muscles">{ex.muscles}</span>
              <span className="badge">{VIEW_LABEL[ex.camera.recommended]}</span>
            </button>
          ))}
        </div>
      </section>

      <section id="how" className="section" aria-labelledby="how-title">
        <div className="section-head">
          <span className="eyebrow">How it works</span>
          <h2 id="how-title">Prop it up. Press start. Listen.</h2>
        </div>
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li className="step" key={s.title}>
              <span className="n">{String(i + 1).padStart(2, '0')}</span>
              <b>{s.title}</b>
              {s.text}
            </li>
          ))}
        </ol>
      </section>

      <section className="section every-body" aria-labelledby="every-body">
        <div className="every-copy">
          <span className="eyebrow">Built for every body</span>
          <h2 id="every-body">Smarter training. Better movement.</h2>
          <p>
            TRACK AI measures your joint angles thirty times a second and checks every rep against good form, so you
            know exactly what to fix and hear it the moment it happens.
          </p>
        </div>
        <div className="score-card">
          <span className="k">{trend.example ? 'Form score · example' : 'Your form score'}</span>
          <b>{latest}</b>
          <Sparkline values={trend.scores} />
          <span className="k">
            {trend.example ? 'Yours appears after a few sets' : change > 3 ? 'Great progress!' : change < -3 ? "Let's get it back up" : 'Nice and steady'}
          </span>
        </div>
      </section>

      {PAYMENTS_ON && <Pricing onPaywall={props.onPaywall} />}

      {!standalone && (
        <section id="get-app" className="section get-app" aria-labelledby="get-app-title">
          <div className="get-app-copy">
            <span className="eyebrow">Get the app</span>
            <h2 id="get-app-title">Your coach, one tap away.</h2>
            <p>
              Install TRACK AI on your phone: its own icon on your home screen, full screen, and it works offline.
              {PAYMENTS_ON ? ' No app store and no account needed.' : ' Free, with no app store and no account.'}
            </p>
            <GetAppButtons />
          </div>
          {desktop && (
            <div className="qr-card">
              <QrCode value={`${location.origin}${import.meta.env.BASE_URL}`} />
              <span>Scan with your phone’s camera</span>
            </div>
          )}
        </section>
      )}

      <footer id="privacy" className="foot">
        <p className="note">
          <IconLock />
          Private by design: your camera feed is analysed on this device and never uploaded.
        </p>
        {hasAiPeople && <p className="note">The people in the pictures and demos are AI-generated. They don't exist.</p>}
      </footer>
    </main>
  );
}

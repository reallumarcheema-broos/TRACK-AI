import { useEffect, useState } from 'react';
import { AI_DEBRIEF_ENABLED } from '../coach/debrief';
import { listEnglishVoices } from '../coach/voice';
import { billingUrl, FREE_WORKOUTS, PAYMENTS_ON, PRICE, removeLicense, useAccess } from '../pay/license';
import type { ModelQuality } from '../pose/detector';
import type { Settings as SettingsT } from '../state/settings';
import { IconBack, IconSound } from './icons';
import type { PaywallStart } from './Paywall';

export interface SettingsProps {
  settings: SettingsT;
  onChange: (patch: Partial<SettingsT>) => void;
  onTestVoice: () => void;
  onPaywall: (start: PaywallStart) => void;
  onBack: () => void;
}

/** The plan on this device: free workouts left, or the subscription and where to manage it. */
function Subscription({ onPaywall }: { onPaywall: (start: PaywallStart) => void }) {
  const access = useAccess();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const billing = billingUrl();

  const remove = async () => {
    if (!confirm('Remove your subscription from this device? You can add it back with your license key.')) return;
    setBusy(true);
    const reply = await removeLicense();
    setBusy(false);
    setMessage(reply.ok ? 'Removed from this device. Your license key now has a free place for another phone.' : reply.message);
  };

  const subscribed = access.kind === 'subscribed' || access.kind === 'recheck';
  return (
    <section className="card">
      <h2 className="eyebrow">Subscription</h2>
      {subscribed ? (
        <>
          <div className="setting">
            <div>
              <div className="label">TRACK AI Pro</div>
              <div className="desc">
                {access.kind === 'subscribed' ? 'Active on this device.' : 'Connect to the internet to confirm your subscription.'}
              </div>
            </div>
            {billing && (
              <a className="btn" href={billing} target="_blank" rel="noopener">
                Manage
              </a>
            )}
          </div>
          <div className="setting">
            <div>
              <div className="label">Move to another phone</div>
              <div className="desc">Frees this device's place on your license key.</div>
            </div>
            <button className="btn" onClick={() => void remove()} disabled={busy}>
              {busy ? 'Removing…' : 'Remove'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="setting">
            <div>
              <div className="label">{access.kind === 'free' && access.ended ? 'Your subscription has ended' : 'Free plan'}</div>
              <div className="desc">
                {access.kind === 'free' ? `${access.left} of ${FREE_WORKOUTS} free workouts left. ` : ''}TRACK AI Pro is {PRICE} a month.
              </div>
            </div>
            <button className="btn" onClick={() => onPaywall('offer')}>
              Subscribe
            </button>
          </div>
          <div className="setting">
            <div>
              <div className="label">Already subscribed?</div>
              <div className="desc">Unlock this device with the license key from your receipt email.</div>
            </div>
            <button className="btn" onClick={() => onPaywall('key')}>
              Enter key
            </button>
          </div>
        </>
      )}
      {message && (
        <p className="desc" role="status">
          {message}
        </p>
      )}
    </section>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button className="switch" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} />;
}

export function Settings({ settings, onChange, onTestVoice, onPaywall, onBack }: SettingsProps) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(listEnglishVoices);
  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return;
    const update = () => setVoices(listEnglishVoices());
    speechSynthesis.addEventListener?.('voiceschanged', update);
    return () => speechSynthesis.removeEventListener?.('voiceschanged', update);
  }, []);

  return (
    <main className="page">
      <header className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <IconBack />
        </button>
        <h1>Settings</h1>
      </header>

      {PAYMENTS_ON && <Subscription onPaywall={onPaywall} />}

      <section className="card">
        <h2 className="eyebrow">Coach voice</h2>
        <div className="setting">
          <div>
            <div className="label">Voice coaching</div>
            <div className="desc">Counts reps and calls out form mistakes during the set.</div>
          </div>
          <Switch label="Voice coaching" checked={settings.voice} onChange={(voice) => onChange({ voice })} />
        </div>
        <div className="setting">
          <div>
            <div className="label">Voice</div>
            <div className="desc">{voices.length ? 'Pick the voice that sounds best on this device.' : 'Your browser has no speech voices.'}</div>
          </div>
          <select
            value={settings.voiceName ?? ''}
            onChange={(e) => onChange({ voiceName: e.target.value || null })}
            aria-label="Voice"
            disabled={!voices.length}
          >
            <option value="">Automatic</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.name}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        </div>
        <div className="setting">
          <div>
            <div className="label">Speaking speed</div>
            <div className="desc">{settings.speechRate.toFixed(2)}×</div>
          </div>
          <input
            type="range"
            min={0.8}
            max={1.3}
            step={0.05}
            value={settings.speechRate}
            onChange={(e) => onChange({ speechRate: Number(e.target.value) })}
            aria-label="Speaking speed"
          />
        </div>
        <div className="setting">
          <div className="label">Test</div>
          <button className="btn" onClick={onTestVoice}>
            <IconSound /> Hear the coach
          </button>
        </div>
        <div className="setting">
          <div>
            <div className="label">Sound effects</div>
            <div className="desc">A chime for clean reps, a blip for faulty ones.</div>
          </div>
          <Switch label="Sound effects" checked={settings.sfx} onChange={(sfx) => onChange({ sfx })} />
        </div>
        {AI_DEBRIEF_ENABLED && (
          <div className="setting">
            <div>
              <div className="label">AI debrief after each set</div>
              <div className="desc">
                Sends your set's numbers (never video) to the TRACK AI server, which asks Claude for a short spoken debrief.
                Falls back to the on-device summary when the server isn't available.
              </div>
            </div>
            <Switch label="AI debrief" checked={settings.aiDebrief} onChange={(aiDebrief) => onChange({ aiDebrief })} />
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="eyebrow">Tracking</h2>
        <div className="setting">
          <div>
            <div className="label">Camera</div>
            <div className="desc">The back camera is sharper; the front one lets you see the screen.</div>
          </div>
          <select value={settings.facingMode} onChange={(e) => onChange({ facingMode: e.target.value as SettingsT['facingMode'] })} aria-label="Camera">
            <option value="user">Front (selfie)</option>
            <option value="environment">Back camera</option>
          </select>
        </div>
        <div className="setting">
          <div>
            <div className="label">Model accuracy</div>
            <div className="desc">Heavier models track better but need a faster device.</div>
          </div>
          <select
            value={settings.model ?? ''}
            onChange={(e) => onChange({ model: (e.target.value || null) as ModelQuality | null })}
            aria-label="Model accuracy"
          >
            <option value="">Automatic</option>
            <option value="lite">Fast (lite)</option>
            <option value="full">Balanced (full)</option>
            <option value="heavy">Accurate (heavy)</option>
          </select>
        </div>
        <div className="setting">
          <div>
            <div className="label">Show skeleton overlay</div>
            <div className="desc">Draws the tracked joints over the camera; faulty joints turn red.</div>
          </div>
          <Switch label="Skeleton overlay" checked={settings.showSkeleton} onChange={(showSkeleton) => onChange({ showSkeleton })} />
        </div>
      </section>

      <p className="note">
        TRACK AI Coach gives general fitness feedback, not medical advice. Stop if anything hurts, and check with a professional
        if you have an injury.
      </p>
    </main>
  );
}

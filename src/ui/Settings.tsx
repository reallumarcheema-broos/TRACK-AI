import { useEffect, useState } from 'react';
import { listEnglishVoices } from '../coach/voice';
import type { ModelQuality } from '../pose/detector';
import type { Settings as SettingsT } from '../state/settings';
import { IconBack, IconSound } from './icons';

export interface SettingsProps {
  settings: SettingsT;
  onChange: (patch: Partial<SettingsT>) => void;
  onTestVoice: () => void;
  onBack: () => void;
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button className="switch" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} />;
}

export function Settings({ settings, onChange, onTestVoice, onBack }: SettingsProps) {
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
        <h1 style={{ fontSize: 22 }}>Settings</h1>
      </header>

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
            <option value="environment">Back</option>
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

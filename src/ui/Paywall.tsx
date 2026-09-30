import { useEffect, useRef, useState, type FormEvent } from 'react';
import { activateLicense, CHECKOUT_URL, FREE_WORKOUTS, getAccess, PRICE, refreshLicense, useAccess } from '../pay/license';
import { IconCheck, IconClose, IconLock } from './icons';
import { Sheet } from './Sheet';

/** Where the sheet opens: the offer, or straight at the license key form. */
export type PaywallStart = 'offer' | 'key';

const PERKS = ['Unlimited workouts, all 8 exercises', 'Rep counting, form checks and a voice coach', 'Private: your video never leaves your phone'];

/** The price and what it buys; also on the home page. */
export function PriceBlock() {
  return (
    <>
      <div className="price">
        <b>{PRICE}</b>
        <span>
          per month
          <br />
          cancel anytime
        </span>
      </div>
      <ul className="perks">
        {PERKS.map((p) => (
          <li key={p}>
            <IconCheck /> {p}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Subscribe through Lemon Squeezy, or unlock with the license key from the receipt email. */
export function Paywall({ start, onClose }: { start: PaywallStart; onClose: () => void }) {
  const access = useAccess();
  const [keyOpen, setKeyOpen] = useState(start === 'key');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyInput = useRef<HTMLInputElement>(null);
  const done = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (keyOpen) keyInput.current?.focus();
  }, [keyOpen]);
  // The form that had focus is gone once the key works.
  useEffect(() => {
    if (access.kind === 'subscribed') done.current?.focus();
  }, [access.kind]);

  const unlock = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const reply = await activateLicense(key);
    setBusy(false);
    if (!reply.ok) setError(reply.message);
  };

  const checkAgain = async () => {
    setBusy(true);
    setError(null);
    await refreshLicense(true);
    setBusy(false);
    if (getAccess().kind === 'recheck') setError("Still can't confirm it. Check your internet connection and try again.");
  };

  const head = (eyebrow: string, title: string) => (
    <div className="sheet-head">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2 id="paywall-title">{title}</h2>
      </div>
      <button className="icon-btn" onClick={onClose} aria-label="Close">
        <IconClose />
      </button>
    </div>
  );

  if (access.kind === 'subscribed' || access.kind === 'open') {
    return (
      <Sheet labelledBy="paywall-title" onClose={onClose}>
        {head('TRACK AI Pro', "You're subscribed")}
        <p className="paywall-lead">Unlimited workouts on this device. Enjoy your training!</p>
        <button ref={done} className="btn primary big" onClick={onClose}>
          <IconCheck /> Start training
        </button>
      </Sheet>
    );
  }

  if (access.kind === 'recheck') {
    return (
      <Sheet labelledBy="paywall-title" onClose={onClose}>
        {head('TRACK AI Pro', 'Confirm your subscription')}
        <p className="paywall-lead">You've been offline for a while. Connect to the internet so we can check your subscription.</p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary big" onClick={() => void checkAgain()} disabled={busy}>
          {busy ? 'Checking…' : 'Check again'}
        </button>
      </Sheet>
    );
  }

  const title = access.ended
    ? 'Your subscription has ended'
    : access.left === 0
      ? `You've used your ${FREE_WORKOUTS} free workouts`
      : 'Keep the coach with you';
  const lead = access.ended
    ? 'Renew to keep training with your coach.'
    : access.left === 0
      ? 'Subscribe to keep training with real-time rep counting, form checks and voice coaching.'
      : `You have ${access.left} free workout${access.left === 1 ? '' : 's'} left. Subscribe any time for unlimited training.`;

  return (
    <Sheet labelledBy="paywall-title" onClose={onClose}>
      {head('TRACK AI Pro', title)}
      <p className="paywall-lead">{lead}</p>
      <PriceBlock />

      {CHECKOUT_URL && (
        <a className="btn primary big" href={CHECKOUT_URL} target="_blank" rel="noopener">
          <IconLock /> Subscribe · {PRICE}/month
        </a>
      )}
      <p className="paywall-small">Secure checkout by Lemon Squeezy. Your license key arrives by email.</p>

      {keyOpen ? (
        <form className="key-form" onSubmit={(e) => void unlock(e)}>
          <label htmlFor="license-key">License key</label>
          <input
            ref={keyInput}
            id="license-key"
            className="field"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-describedby="license-key-help"
          />
          <p id="license-key-help" className="paywall-small">
            It's in your Lemon Squeezy receipt email.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="btn" type="submit" disabled={busy || !key.trim()}>
            {busy ? 'Checking…' : 'Unlock'}
          </button>
        </form>
      ) : (
        <button className="btn ghost" onClick={() => setKeyOpen(true)}>
          I have a license key
        </button>
      )}
    </Sheet>
  );
}

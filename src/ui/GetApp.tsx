import { useEffect, useRef, useState, type ReactNode } from 'react';
import { promptInstall, useInstall, type Platform } from '../pwa/install';
import { IconClose } from './icons';

type Target = 'ios' | 'android';

/** Real store listings, once the app is published there; until then the buttons install the web app. */
const STORE: Record<Target, string | undefined> = {
  ios: import.meta.env.VITE_APP_STORE_URL as string | undefined,
  android: import.meta.env.VITE_PLAY_STORE_URL as string | undefined,
};

const NAME: Record<Target, string> = { ios: 'iPhone', android: 'Android' };

const siteUrl = () => `${location.origin}${import.meta.env.BASE_URL}`;

/** "Install on iPhone" / "Install on Android". Hidden inside the installed app. */
export function GetAppButtons() {
  const install = useInstall();
  const [sheet, setSheet] = useState<Target | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  // The open sheet owns a history entry, so the phone's back gesture closes it instead of leaving the page.
  useEffect(() => {
    if (!sheet) return;
    const onPop = () => {
      if (history.state?.sheet) return;
      setSheet(null);
      opener.current?.focus();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [sheet]);

  if (install.standalone) return null;
  if (install.installed) {
    return <p className="installed-note">✓ Installed. Open TRACK AI from your home screen.</p>;
  }

  const open = async (target: Target, el: HTMLElement) => {
    opener.current = el;
    // Android (and desktop Chrome/Edge) can install with one tap.
    if (target === 'android' && install.platform === 'android' && install.canPrompt) {
      const outcome = await promptInstall();
      if (outcome !== 'unavailable') return;
    }
    if (!history.state?.sheet) history.pushState({ ...history.state, sheet: true }, '');
    setSheet(target);
  };

  const close = () => {
    if (history.state?.sheet) return history.back(); // the popstate listener above closes it
    setSheet(null);
    opener.current?.focus();
  };

  return (
    <>
      <div className="app-buttons">
        {(['ios', 'android'] as const).map((target) =>
          STORE[target] ? (
            <a key={target} className="app-btn" href={STORE[target]} target="_blank" rel="noopener">
              <IconPhone />
              <span>
                <small>Download for</small> {NAME[target]}
              </span>
            </a>
          ) : (
            <button key={target} className="app-btn" onClick={(e) => void open(target, e.currentTarget)}>
              <IconPhone />
              <span>
                <small>Install on</small> {NAME[target]}
              </span>
            </button>
          ),
        )}
      </div>
      {sheet && <InstallSheet target={sheet} platform={install.platform} inAppBrowser={install.inAppBrowser} onClose={close} />}
    </>
  );
}

function InstallSheet(props: { target: Target; platform: Platform; inAppBrowser: boolean; onClose: () => void }) {
  const { target, platform, inAppBrowser, onClose } = props;
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onThisPhone = platform === target;
  const browser = target === 'ios' ? 'Safari' : 'Chrome';

  useEffect(() => {
    closeRef.current?.focus();
    // A modal: the page behind stays put and Tab cycles through the sheet's own controls.
    // Hiding the page's scrollbar would widen it, so pad by the scrollbar's width meanwhile.
    const { overflow, paddingRight } = document.body.style;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onCloseRef.current();
      const sheet = sheetRef.current;
      if (e.key !== 'Tab' || !sheet) return;
      const items = sheet.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
      const first = items[0];
      const last = items[items.length - 1];
      const inside = sheet.contains(document.activeElement);
      if (e.shiftKey ? !inside || document.activeElement === first : !inside || document.activeElement === last) {
        e.preventDefault();
        (e.shiftKey ? last : first)?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
    };
  }, []);

  const steps: { icon: ReactNode; title: string; text: string }[] =
    target === 'ios'
      ? [
          { icon: <IconShare />, title: 'Tap the Share button', text: 'At the bottom of Safari (top right on iPad).' },
          { icon: <IconAddSquare />, title: 'Tap “Add to Home Screen”', text: 'Scroll down the list if you don’t see it.' },
          { icon: <IconCheckCircle />, title: 'Tap “Add”', text: 'TRACK AI appears on your home screen. Open it from there.' },
        ]
      : [
          { icon: <IconDots />, title: 'Tap the ⋮ menu', text: 'Top right in Chrome.' },
          { icon: <IconAddSquare />, title: 'Tap “Install app”', text: 'Some phones call it “Add to Home screen”.' },
          { icon: <IconCheckCircle />, title: 'Tap “Install”', text: 'TRACK AI appears with your other apps.' },
        ];

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div ref={sheetRef} className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <span className="eyebrow">Free · No app store · Works offline</span>
            <h2 id="sheet-title">Install on {NAME[target]}</h2>
          </div>
          <button ref={closeRef} className="icon-btn" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </div>

        {!onThisPhone &&
          (platform === 'desktop' ? (
            <div className="sheet-qr">
              <QrCode value={siteUrl()} />
              <p>
                Scan with your {NAME[target]}’s camera to open TRACK AI in {browser}, then follow these steps.
              </p>
            </div>
          ) : (
            <p className="sheet-note">
              Open <b>{siteUrl()}</b> on your {NAME[target]} in {browser}, then follow these steps.
            </p>
          ))}

        {onThisPhone && inAppBrowser && (
          <p className="sheet-note warn">
            You’re in another app’s built-in browser, which can’t install apps. Tap its ••• menu and choose “Open in {browser}”
            first.
          </p>
        )}

        <ol className="sheet-steps">
          {steps.map((s, i) => (
            <li key={s.title}>
              <span className="n">{i + 1}</span>
              <span className="glyph">{s.icon}</span>
              <div>
                <b>{s.title}</b>
                <span>{s.text}</span>
              </div>
            </li>
          ))}
        </ol>

        <button className="btn primary big" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}

/** QR code for the site's address; the encoder only loads when a QR is shown. */
export function QrCode({ value }: { value: string }) {
  const [cells, setCells] = useState<boolean[][] | null>(null);
  useEffect(() => {
    let live = true;
    void import('qrcode-generator').then(({ default: qrcode }) => {
      const qr = qrcode(0, 'M');
      qr.addData(value);
      qr.make();
      const n = qr.getModuleCount();
      if (live) setCells(Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c))));
    });
    return () => {
      live = false;
    };
  }, [value]);
  if (!cells) return <div className="qr" aria-hidden="true" />;
  const n = cells.length;
  return (
    <svg className="qr" viewBox={`-2 -2 ${n + 4} ${n + 4}`} role="img" aria-label={`QR code for ${value}`} shapeRendering="crispEdges">
      <rect x="-2" y="-2" width={n + 4} height={n + 4} fill="#fff" />
      <path
        fill="#17120e"
        d={cells.flatMap((row, r) => row.map((dark, c) => (dark ? `M${c} ${r}h1v1h-1z` : ''))).join('')}
      />
    </svg>
  );
}

const Svg = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const IconPhone = () => (
  <Svg>
    <rect x="6" y="2" width="12" height="20" rx="3" />
    <path d="M12 7v7M9 11l3 3 3-3M10.5 18.5h3" />
  </Svg>
);

const IconShare = () => (
  <Svg>
    <path d="M12 3v12M8 7l4-4 4 4" />
    <path d="M7 10H6a2 2 0 00-2 2v7a2 2 0 002 2h12a2 2 0 002-2v-7a2 2 0 00-2-2h-1" />
  </Svg>
);

const IconAddSquare = () => (
  <Svg>
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <path d="M12 8v8M8 12h8" />
  </Svg>
);

const IconDots = () => (
  <Svg>
    <circle cx="12" cy="5" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="12" cy="19" r="1.2" fill="currentColor" />
  </Svg>
);

const IconCheckCircle = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.5 2.5L16 9.5" />
  </Svg>
);

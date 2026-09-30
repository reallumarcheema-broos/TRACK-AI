import { useEffect, useRef } from 'react';
import { adsenseClient, adSlot } from '../site/site';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const CLIENT = adsenseClient(import.meta.env.VITE_ADSENSE_CLIENT as string | undefined);
const SLOT = adSlot(import.meta.env.VITE_ADSENSE_SLOT as string | undefined);

/**
 * A responsive Google AdSense display unit, labelled as an ad. Renders nothing until
 * VITE_ADSENSE_CLIENT and VITE_ADSENSE_SLOT are set. Never used on the workout screen.
 */
export function Ad() {
  const ins = useRef<HTMLModElement>(null);

  useEffect(() => {
    // Each <ins> takes one ad; the dev build's double effect mustn't ask twice.
    if (!ins.current || ins.current.dataset.adsbygoogleStatus) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Blocked by an ad blocker, or AdSense isn't ready yet: the space just stays empty.
    }
  }, []);

  if (!CLIENT || !SLOT) return null;
  return (
    <div className="ad">
      <span className="ad-label">Advertisement</span>
      <ins
        ref={ins}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={CLIENT}
        data-ad-slot={SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
        {...(import.meta.env.DEV ? { 'data-adtest': 'on' } : {})}
      />
    </div>
  );
}

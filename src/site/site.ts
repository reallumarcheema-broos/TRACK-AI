/**
 * Site-wide settings for the public website: Google AdSense, the site's address, the contact
 * address and the pages every visitor can reach. Pure functions, shared by the build (vite.config.ts)
 * and the app.
 */

export const SITE_NAME = 'TRACK AI Coach';

/** A Google AdSense publisher id as "ca-pub-…" (accepts "pub-…" too); null when missing or malformed. */
export function adsenseClient(raw: string | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  const id = v.startsWith('ca-') ? v : `ca-${v}`;
  return /^ca-pub-\d{10,20}$/.test(id) ? id : null;
}

/** An AdSense ad unit id (digits only); null when missing or malformed. */
export function adSlot(raw: string | undefined): string | null {
  const v = raw?.trim();
  return v && /^\d{5,20}$/.test(v) ? v : null;
}

export function contactEmail(raw: string | undefined): string | null {
  const v = raw?.trim();
  return v && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(v) ? v : null;
}

export interface SiteConfig {
  /** The public address, e.g. https://trackai.fit (no trailing slash); null when unknown. */
  siteUrl: string | null;
  adsenseClient: string | null;
  adSlot: string | null;
  contactEmail: string | null;
  /** The optional AI debrief (a TRACK AI server) is on; the privacy policy then explains it. */
  aiDebrief: boolean;
}

/**
 * Reads the build environment. SITE_URL wins; on Vercel the production address is known anyway
 * (VERCEL_PROJECT_PRODUCTION_URL).
 */
export function siteConfig(env: Record<string, string | undefined>): SiteConfig {
  const raw = env.SITE_URL?.trim() || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
  let siteUrl: string | null = null;
  try {
    if (raw) siteUrl = new URL(raw).origin;
  } catch {
    siteUrl = null;
  }
  return {
    siteUrl,
    adsenseClient: adsenseClient(env.VITE_ADSENSE_CLIENT),
    adSlot: adSlot(env.VITE_ADSENSE_SLOT),
    contactEmail: contactEmail(env.VITE_CONTACT_EMAIL),
    aiDebrief: env.VITE_AI_DEBRIEF !== 'off',
  };
}

/** The line Google asks for in /ads.txt, which says who may sell ads on this site. */
export const adsTxt = (client: string) => `google.com, ${client.slice('ca-'.length)}, DIRECT, f08c47fec0942fa0\n`;

/** The AdSense code for <head>: the site-ownership tag and the ad script. */
export const adsenseHead = (client: string) =>
  `<meta name="google-adsense-account" content="${client}" />\n` +
  `    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}" crossorigin="anonymous"></script>`;

/** Where the AdSense script connects to (for the Content-Security-Policy). */
export const ADSENSE_CONNECT_SRC = [
  'https://*.google.com',
  'https://*.googlesyndication.com',
  'https://*.doubleclick.net',
  'https://*.googleadservices.com',
  'https://*.gstatic.com',
  'https://*.adtrafficquality.google',
];

/** The public pages, for footers and the sitemap. Contact only exists with a contact address. */
export function siteLinks(hasContact: boolean): { href: string; label: string }[] {
  return [
    { href: 'guides', label: 'Exercise guides' },
    { href: 'about', label: 'About' },
    { href: 'privacy', label: 'Privacy policy' },
    { href: 'terms', label: 'Terms of use' },
    ...(hasContact ? [{ href: 'contact', label: 'Contact' }] : []),
  ];
}

export function robotsTxt(siteUrl: string | null): string {
  return `User-agent: *\nAllow: /\n${siteUrl ? `\nSitemap: ${siteUrl}/sitemap.xml\n` : ''}`;
}

export function sitemapXml(siteUrl: string, paths: string[], lastmod: string): string {
  const urls = paths.map((p) => `  <url><loc>${siteUrl}/${p}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

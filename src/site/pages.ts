/**
 * The website's content pages (exercise guides, about, privacy, terms, contact) as plain HTML, so
 * they load instantly and search engines and Google AdSense's reviewers can read them without
 * running the app. Built by vite.config.ts; served at /guides, /privacy… (Vercel's cleanUrls, and
 * the Node server does the same).
 */
import { exerciseCues, type ExerciseDef } from '../core/exercise';
import { EXERCISES } from '../exercises';
import { GUIDES } from './guides';
import { adsenseHead, SITE_NAME, siteLinks, type SiteConfig } from './site';

export interface PageAssets {
  /** The site's base path, e.g. "/". */
  base: string;
  stylesheets: string[];
  fonts: string[];
}

export interface SitePage {
  /** URL path without the base, e.g. "guides/squat". */
  path: string;
  /** Output file, e.g. "guides/squat.html". */
  file: string;
  html: string;
}

/** When the privacy policy and terms last changed. */
export const POLICY_DATE = '30 September 2026';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const LOGO =
  '<svg width="38" height="38" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#17120e" />' +
  '<path d="M16 46L28 20L48 38" fill="none" stroke="#d8a066" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" />' +
  '<path d="M23.8 29.1A10 10 0 0 0 35.4 26.7" fill="none" stroke="#d8a066" stroke-width="2.5" stroke-linecap="round" opacity="0.7" />' +
  '<circle cx="16" cy="46" r="5" fill="#f6efe6" /><circle cx="28" cy="20" r="5" fill="#f6efe6" /><circle cx="48" cy="38" r="5" fill="#f6efe6" /></svg>';

/** A responsive AdSense display unit, labelled as an ad; empty until AdSense is set up. */
function adUnit(config: SiteConfig): string {
  if (!config.adsenseClient || !config.adSlot) return '';
  return (
    `<div class="ad"><span class="ad-label">Advertisement</span>` +
    `<ins class="adsbygoogle" style="display:block" data-ad-client="${config.adsenseClient}" data-ad-slot="${config.adSlot}" data-ad-format="auto" data-full-width-responsive="true"></ins>` +
    `<script>(adsbygoogle = window.adsbygoogle || []).push({});</script></div>`
  );
}

function layout(page: { path: string; title: string; description: string; body: string }, config: SiteConfig, assets: PageAssets): string {
  const { base } = assets;
  const url = config.siteUrl ? `${config.siteUrl}${base}${page.path}` : null;
  const links = siteLinks(config.contactEmail !== null)
    .map((l) => `<a href="${base}${l.href}"${l.href === page.path ? ' aria-current="page"' : ''}>${l.label}</a>`)
    .join('');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#efe8de" />
    <title>${esc(page.title)} · ${SITE_NAME}</title>
    <meta name="description" content="${esc(page.description)}" />
    ${url ? `<link rel="canonical" href="${url}" />\n    <meta property="og:url" content="${url}" />` : ''}
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:title" content="${esc(page.title)}" />
    <meta property="og:description" content="${esc(page.description)}" />
    <link rel="icon" type="image/svg+xml" href="${base}icons/icon.svg" />
    <link rel="apple-touch-icon" href="${base}icons/apple-touch-icon.png" />
    ${assets.fonts.map((f) => `<link rel="preload" href="${f}" as="font" type="font/woff2" crossorigin />`).join('\n    ')}
    ${assets.stylesheets.map((c) => `<link rel="stylesheet" href="${c}" />`).join('\n    ')}
    ${config.adsenseClient ? adsenseHead(config.adsenseClient) : ''}
  </head>
  <body>
    <main class="page doc">
      <header class="topbar">
        <a class="brand" href="${base}" aria-label="${SITE_NAME} home">${LOGO}<span class="wordmark">TRACK AI <small>Coach</small></span></a>
        <span class="spacer"></span>
        <a class="btn primary doc-cta" href="${base}">Open the coach</a>
      </header>
      <article class="doc-body">
${page.body}
      </article>
      <footer class="foot">
        <nav class="foot-links" aria-label="Site">${links}</nav>
        <p class="note">Free to use, supported by ads. Your camera feed is analysed on your device and never uploaded.</p>
      </footer>
    </main>
  </body>
</html>
`;
}

function guidePage(ex: ExerciseDef, config: SiteConfig, base: string) {
  const g = GUIDES[ex.id];
  const seen = new Set<string>();
  const mistakes = [...exerciseCues(ex).values()].filter((c) => !seen.has(c.title) && seen.add(c.title));
  const others = EXERCISES.filter((o) => o.id !== ex.id);
  const body = `
<nav class="crumbs" aria-label="Breadcrumb"><a href="${base}guides">Exercise guides</a> <span aria-hidden="true">›</span> ${esc(ex.name)}</nav>
<span class="eyebrow">Form guide · ${esc(ex.muscles)}</span>
<h1>${esc(g.title)}</h1>
<p class="lead">${esc(g.intro)}</p>
<h2>Step by step</h2>
<ol class="doc-steps">${g.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
${adUnit(config)}
<h2>Common mistakes the coach checks</h2>
<ul class="doc-list">${mistakes.map((m) => `<li><b>${esc(m.title)}.</b> ${esc(m.tip)}</li>`).join('')}</ul>
<h2>Sets and reps</h2>
<p>${esc(g.programming)}</p>
<h2>Make it easier or harder</h2>
<ul class="doc-list"><li><b>Easier:</b> ${esc(g.easier)}</li><li><b>Harder:</b> ${esc(g.harder)}</li></ul>
<h2>Stay safe</h2>
<p>${esc(g.safety)}</p>
<section class="card doc-try">
  <h2>Check your form with the AI coach</h2>
  <p>${esc(ex.camera.placement)} ${esc(ex.camera.why)} It counts your reps and tells you out loud when your form slips.</p>
  <a class="btn primary" href="${base}?exercise=${ex.id}">Start a ${esc(ex.name.toLowerCase())} set</a>
</section>
<h2>More form guides</h2>
<ul class="doc-related">${others.map((o) => `<li><a href="${base}guides/${o.id}">${esc(GUIDES[o.id].title)}</a></li>`).join('')}</ul>
${adUnit(config)}`;
  return { path: `guides/${ex.id}`, title: g.title, description: g.summary, body };
}

function guidesIndex(config: SiteConfig, base: string) {
  const body = `
<span class="eyebrow">Exercise guides</span>
<h1>Move well, step by step</h1>
<p class="lead">Short, practical guides to the eight exercises the TRACK AI coach tracks: how to do each one, the mistakes it checks for, and how many reps to start with.</p>
<ul class="doc-cards">${EXERCISES.map(
    (ex) =>
      `<li><a class="card doc-card" href="${base}guides/${ex.id}"><b>${esc(GUIDES[ex.id].title)}</b><span>${esc(ex.tagline)}</span><span class="muscles">${esc(ex.muscles)}</span></a></li>`,
  ).join('')}</ul>
${adUnit(config)}`;
  return {
    path: 'guides',
    title: 'Exercise guides',
    description: 'Step-by-step form guides for squats, push-ups, lunges, Romanian deadlifts, curls, shoulder presses, jumping jacks and planks.',
    body,
  };
}

function aboutPage(config: SiteConfig, base: string) {
  const body = `
<span class="eyebrow">About</span>
<h1>An AI trainer in your phone</h1>
<p class="lead">${SITE_NAME} is a free personal trainer that runs in your web browser. Prop up your phone, pick an exercise and it counts your reps, checks your form and talks you through the set, out loud.</p>
<h2>How it works</h2>
<p>The coach uses your camera and an on-device body-tracking model (Google's MediaPipe Pose) that finds 33 points on your body about thirty times a second. From those points it measures joint angles, such as how deep your squat goes or whether your hips sag in a plank, and compares every rep with good form for that exercise.</p>
<p>When something slips, it tells you straight away with a short spoken cue, the way a coach standing next to you would. After the set you get a summary: clean reps, a form score and the one thing to work on next time.</p>
<h2>Private by design</h2>
<p>All of the tracking happens on your device. Your camera video is never uploaded, recorded or stored, and you don't need an account. Your workout history stays in your browser.</p>
<h2>Free, supported by ads</h2>
<p>${SITE_NAME} is free to use. Ads on the website pay for it; they never appear while you are training. See the <a href="${base}privacy">privacy policy</a> for how ads work.</p>
<h2>Eight exercises</h2>
<p>Squats, push-ups, lunges, Romanian deadlifts, bicep curls, shoulder presses, jumping jacks and planks. Each has a <a href="${base}guides">form guide</a> you can read before you train.</p>
<p class="doc-disclaimer">${SITE_NAME} gives general fitness feedback, not medical advice. See the <a href="${base}terms">terms of use</a>.</p>
${config.contactEmail ? `<p>Questions or feedback? <a href="${base}contact">Get in touch</a>.</p>` : ''}`;
  return {
    path: 'about',
    title: 'About',
    description: `${SITE_NAME} is a free AI personal trainer that counts reps, checks your form and coaches you out loud, right in your browser.`,
    body,
  };
}

function privacyPage(config: SiteConfig) {
  const contact = config.contactEmail
    ? `<p>Questions about this policy? Email <a href="mailto:${esc(config.contactEmail)}">${esc(config.contactEmail)}</a>.</p>`
    : '';
  const body = `
<span class="eyebrow">Privacy policy</span>
<h1>Privacy policy</h1>
<p class="doc-updated">Last updated ${POLICY_DATE}</p>
<p class="lead">In short: your camera video never leaves your device, we don't ask who you are, and the website shows ads from Google, which uses cookies.</p>
<h2>Your camera</h2>
<p>When you start a set, the app asks for permission to use your camera. The video is analysed by a body-tracking model that runs inside your browser. It is never uploaded, recorded or stored, and the camera turns off when the set ends.</p>
<h2>What stays on your device</h2>
<p>Your settings and workout history (exercise, reps, form score and date) are saved in your browser's local storage so you can see your progress. We can't see them. You can delete them at any time from History → Clear history, or by clearing this site's data in your browser. The site also keeps an offline copy of itself in your browser so it opens without a connection.</p>
${
  config.aiDebrief
    ? `<h2>AI debrief (optional)</h2>
<p>If the AI debrief is switched on in Settings, the numbers from a finished set (exercise, rep count, form score and which mistakes happened) are sent to our server and to Anthropic's Claude to write a short summary. No video, images or personal details are sent. Switch it off in Settings to keep everything on your device.</p>`
    : ''
}
<h2>Advertising and cookies</h2>
<p>We show ads through Google AdSense to keep the website free. Third-party vendors, including Google, use cookies to serve ads based on your prior visits to this website or other websites. Google's use of advertising cookies enables it and its partners to serve ads to you based on your visits to this site and/or other sites on the internet.</p>
<ul class="doc-list">
  <li>You can opt out of personalised advertising in Google's <a href="https://adssettings.google.com" rel="noopener">Ads Settings</a>.</li>
  <li>You can opt out of some third-party vendors' use of cookies for personalised advertising at <a href="https://www.aboutads.info/choices" rel="noopener">aboutads.info</a>.</li>
  <li>To learn how Google uses information from sites that use its services, see <a href="https://policies.google.com/technologies/partner-sites" rel="noopener">How Google uses information from sites or apps that use our services</a>.</li>
</ul>
<p>If you are in the European Economic Area, the United Kingdom or Switzerland, a consent message from Google asks for your choice before personalised ads are shown, and you can change it later from the same message. Without consent you may still see non-personalised ads, which use cookies only for things like frequency capping and fraud prevention.</p>
<h2>Our host</h2>
<p>Like every website, our hosting provider receives basic technical information when you visit (such as your IP address, browser type and the pages requested) to deliver the site and keep it secure. We don't use it to identify you.</p>
<h2>Children</h2>
<p>${SITE_NAME} is not directed at children under 13 (under 16 in the European Economic Area), and we don't knowingly collect their personal information.</p>
<h2>Changes</h2>
<p>If this policy changes, we'll update it here and change the date at the top.</p>
${contact}`;
  return {
    path: 'privacy',
    title: 'Privacy policy',
    description: `How ${SITE_NAME} handles your data: camera video stays on your device, and the website shows ads from Google AdSense.`,
    body,
  };
}

function termsPage(config: SiteConfig, base: string) {
  const body = `
<span class="eyebrow">Terms of use</span>
<h1>Terms of use</h1>
<p class="doc-updated">Last updated ${POLICY_DATE}</p>
<p class="lead">By using ${SITE_NAME} you agree to these terms. Please read the health notice below before you train.</p>
<h2>Health notice</h2>
<p>${SITE_NAME} gives general fitness information and automated feedback. It is not medical advice and doesn't replace a doctor, physiotherapist or qualified coach. Check with a health professional before starting a new exercise programme, especially if you are pregnant, injured or have a medical condition. Stop straight away if you feel pain, dizziness or shortness of breath. Make sure you have enough clear space around you, and train at your own risk.</p>
<h2>How accurate it is</h2>
<p>The coach tracks your body from a phone camera, so rep counts and form feedback can be wrong, especially with poor light, loose clothing or part of your body out of view. Use it as a guide, not a judge.</p>
<h2>Using the service</h2>
<p>You may use ${SITE_NAME} for your own personal training. Don't misuse it: no attempts to break, overload or interfere with the website, and no automated scraping.</p>
<h2>Ads and links</h2>
<p>The website shows ads from Google AdSense and may link to other websites. We don't control and aren't responsible for third-party content, products or services. How ads use data is explained in the <a href="${base}privacy">privacy policy</a>.</p>
<h2>No warranty</h2>
<p>${SITE_NAME} is provided "as is", without warranties of any kind. To the extent the law allows, we are not liable for any injury, loss or damage arising from your use of it.</p>
<h2>Changes</h2>
<p>We may update the service and these terms. If you keep using ${SITE_NAME} after a change, you accept the updated terms.</p>
${config.contactEmail ? `<p>Questions? Email <a href="mailto:${esc(config.contactEmail)}">${esc(config.contactEmail)}</a>.</p>` : ''}`;
  return {
    path: 'terms',
    title: 'Terms of use',
    description: `Terms of use and health notice for ${SITE_NAME}.`,
    body,
  };
}

function contactPage(email: string) {
  const body = `
<span class="eyebrow">Contact</span>
<h1>Get in touch</h1>
<p class="lead">Questions, feedback, an exercise you'd like the coach to learn, or something not working? We'd love to hear from you.</p>
<p><a class="btn primary" href="mailto:${esc(email)}">Email ${esc(email)}</a></p>
<h2>Reporting a problem</h2>
<p>It helps to tell us which phone or computer and which browser you use, which exercise you were doing, and what happened. A screenshot is great too.</p>`;
  return { path: 'contact', title: 'Contact', description: `Contact ${SITE_NAME}: questions, feedback and support.`, body };
}

/** Every content page, ready to write out. */
export function sitePages(config: SiteConfig, assets: PageAssets): SitePage[] {
  const { base } = assets;
  const pages = [
    guidesIndex(config, base),
    ...EXERCISES.map((ex) => guidePage(ex, config, base)),
    aboutPage(config, base),
    privacyPage(config),
    termsPage(config, base),
    ...(config.contactEmail ? [contactPage(config.contactEmail)] : []),
  ];
  return pages.map((p) => ({ path: p.path, file: `${p.path}.html`, html: layout(p, config, assets) }));
}

import { describe, expect, it } from 'vitest';
import { exerciseCues } from '../core/exercise';
import { EXERCISES } from '../exercises';
import { ARTICLES } from './articles';
import { FEATURED } from './featured';
import { siteFiles } from './files';
import { sitePages } from './pages';
import { adsenseClient, adSlot, adsTxt, siteConfig, siteVerification } from './site';

const ASSETS = { base: '/', stylesheets: ['/assets/index.css'], fonts: ['/assets/inter.woff2'] };
const ADS = siteConfig({
  VITE_ADSENSE_CLIENT: 'pub-1234567890123456',
  VITE_ADSENSE_SLOT: '9876543210',
  SITE_URL: 'https://trackai.example/',
  VITE_CONTACT_EMAIL: 'hello@trackai.example',
});
const PLAIN = siteConfig({});

describe('site settings', () => {
  it('accepts an AdSense publisher id with or without "ca-"', () => {
    expect(adsenseClient('pub-1234567890123456')).toBe('ca-pub-1234567890123456');
    expect(adsenseClient(' ca-pub-1234567890123456 ')).toBe('ca-pub-1234567890123456');
    expect(adsenseClient('1234567890123456')).toBeNull();
    expect(adsenseClient('ca-pub-12<script>')).toBeNull();
    expect(adSlot('9876543210')).toBe('9876543210');
    expect(adSlot('abc')).toBeNull();
  });

  it("accepts Search Console's HTML tag code", () => {
    expect(siteVerification(' abcDEF123_-xyz789 ')).toBe('abcDEF123_-xyz789');
    expect(siteVerification('<meta name="google-site-verification" content="x">')).toBeNull();
    expect(siteConfig({ GOOGLE_SITE_VERIFICATION: 'abcDEF123_-xyz789' }).googleSiteVerification).toBe('abcDEF123_-xyz789');
    expect(siteConfig({}).googleSiteVerification).toBeNull();
  });

  it("takes the address from SITE_URL or Vercel's production address", () => {
    expect(ADS.siteUrl).toBe('https://trackai.example');
    expect(siteConfig({ VERCEL_PROJECT_PRODUCTION_URL: 'trackai.vercel.app' }).siteUrl).toBe('https://trackai.vercel.app');
    expect(siteConfig({ SITE_URL: 'not a url' }).siteUrl).toBeNull();
  });

  it("writes Google's ads.txt line", () => {
    expect(adsTxt('ca-pub-1234567890123456')).toBe('google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n');
  });
});

describe('website files', () => {
  it('has a guide for every exercise, the articles and the policy pages', () => {
    const paths = sitePages(PLAIN, ASSETS).map((p) => p.path);
    expect(paths).toEqual([
      'guides',
      'guides/squat',
      'guides/pushup',
      'guides/lunge',
      'guides/rdl',
      'guides/curl',
      'guides/press',
      'guides/jumping_jack',
      'guides/plank',
      'articles',
      'articles/beginner-full-body-workout',
      'articles/warm-up',
      'articles/sets-and-reps',
      'articles/progressive-overload-at-home',
      'articles/rest-days-and-recovery',
      'articles/knees-caving-in-squat',
      'articles/pushup-hips-sagging',
      'articles/lunge-balance-and-depth',
      'articles/romanian-deadlift-hinge',
      'articles/shoulder-press-leaning-back',
      'articles/bicep-curl-swinging',
      'articles/how-long-to-hold-a-plank',
      'articles/phone-setup',
      'articles/how-ai-form-tracking-works',
      'about',
      'privacy',
      'terms',
    ]);
  });

  it('only links to pages that exist', () => {
    for (const config of [PLAIN, ADS]) {
      const pages = sitePages(config, ASSETS);
      const known = new Set(['', ...pages.map((p) => p.path)]);
      for (const page of pages) {
        for (const [, href] of page.html.matchAll(/href="\/([^"?#]*)[^"]*"/g)) {
          if (href.startsWith('icons/') || href.startsWith('assets/')) continue;
          expect(known, `${page.path} links to /${href}`).toContain(href);
        }
      }
    }
  });

  it('turns article text into HTML with nothing left over', () => {
    for (const page of sitePages(PLAIN, ASSETS).filter((p) => p.path.startsWith('articles/'))) {
      expect(page.html, page.path).not.toMatch(/\*\*|\]\(/);
    }
    expect(new Set(ARTICLES.map((a) => a.slug)).size).toBe(ARTICLES.length);
  });

  it('features real articles on the home page', () => {
    for (const f of FEATURED) {
      expect(ARTICLES.find((a) => a.slug === f.slug)?.title, f.slug).toBe(f.title);
    }
  });

  it('describes guides and articles to search engines and share previews', () => {
    const pages = sitePages(ADS, ASSETS);
    const article = pages.find((p) => p.path === 'articles/warm-up')!.html;
    const [, json] = article.match(/<script type="application\/ld\+json">(.*?)<\/script>/)!;
    const data = JSON.parse(json);
    expect(data).toMatchObject({
      '@type': 'Article',
      headline: ARTICLES.find((a) => a.slug === 'warm-up')!.title,
      mainEntityOfPage: 'https://trackai.example/articles/warm-up',
      image: 'https://trackai.example/og-image.png',
    });
    expect(article).toContain('<meta property="og:image" content="https://trackai.example/og-image.png" />');
    expect(article).toContain('<meta property="og:type" content="article" />');
    const guide = pages.find((p) => p.path === 'guides/squat')!.html;
    expect(JSON.parse(guide.match(/<script type="application\/ld\+json">(.*?)<\/script>/)![1]).headline).toBe('How to do a squat');
    expect(pages.find((p) => p.path === 'privacy')!.html).not.toContain('application/ld+json');
    // Without a known address there's nothing absolute to point at.
    expect(sitePages(PLAIN, ASSETS).some((p) => p.html.includes('og:image'))).toBe(false);
  });

  it('adds AdSense, ads.txt, a sitemap and the contact page when configured', () => {
    const files = siteFiles(ADS, ASSETS, '2026-09-30');
    const file = (name: string) => files.find((f) => f.file === name)?.body ?? '';
    expect(file('ads.txt')).toContain('pub-1234567890123456');
    expect(file('robots.txt')).toContain('Sitemap: https://trackai.example/sitemap.xml');
    expect(file('sitemap.xml')).toContain('<loc>https://trackai.example/guides/squat</loc>');
    expect(file('sitemap.xml')).toContain('<loc>https://trackai.example/articles/warm-up</loc>');
    expect(file('contact.html')).toContain('mailto:hello@trackai.example');
    const squat = file('guides/squat.html');
    expect(squat).toContain('adsbygoogle.js?client=ca-pub-1234567890123456');
    expect(squat).toContain('data-ad-slot="9876543210"');
    expect(squat).toContain('<link rel="canonical" href="https://trackai.example/guides/squat" />');
  });

  it('leaves ads, ads.txt, the sitemap and the contact page out until they are set up', () => {
    const files = siteFiles(PLAIN, ASSETS, '2026-09-30').map((f) => f.file);
    expect(files).not.toContain('ads.txt');
    expect(files).not.toContain('sitemap.xml');
    expect(files).not.toContain('contact.html');
    expect(sitePages(PLAIN, ASSETS).every((p) => !p.html.includes('adsbygoogle'))).toBe(true);
  });

  it("includes the disclosures Google's AdSense policies require in the privacy policy", () => {
    const privacy = sitePages(PLAIN, ASSETS).find((p) => p.path === 'privacy')!.html;
    expect(privacy).toContain('Third-party vendors, including Google, use cookies to serve ads based on your prior visits');
    expect(privacy).toContain('https://adssettings.google.com');
    expect(privacy).toContain('https://policies.google.com/technologies/partner-sites');
    expect(privacy).toContain('camera');
  });

  it('lists the mistakes the coach checks in each guide', () => {
    const squat = sitePages(PLAIN, ASSETS).find((p) => p.path === 'guides/squat')!.html;
    expect(squat).toContain('<b>Knees caving in.</b>');
    expect(squat).toContain('href="/?exercise=squat"');
  });

  it("puts each guide's own article first among the related articles", () => {
    const pages = sitePages(PLAIN, ASSETS);
    const related = (id: string) => pages.find((p) => p.path === `guides/${id}`)!.html.split('<h2>Related articles</h2>')[1];
    expect(related('curl')).toMatch(/^\s*<ul class="doc-related"><li><a href="\/articles\/bicep-curl-swinging">/);
    expect(related('rdl')).toMatch(/^\s*<ul class="doc-related"><li><a href="\/articles\/romanian-deadlift-hinge">/);
  });

  it('names only faults the coach really checks', () => {
    const titles = new Set(EXERCISES.flatMap((ex) => [...exerciseCues(ex).values()].map((c) => c.title)));
    for (const a of ARTICLES) {
      for (const [, quoted] of JSON.stringify(a.blocks).matchAll(/\*\*“([^”]+)”\*\*/g)) {
        if (quoted === 'Spread the floor.') continue; // a cue to think, not one the coach calls out
        expect(titles, `${a.slug} quotes “${quoted}”`).toContain(quoted);
      }
    }
  });
});

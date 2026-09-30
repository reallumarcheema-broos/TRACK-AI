import { describe, expect, it } from 'vitest';
import { siteFiles } from './files';
import { sitePages } from './pages';
import { adsenseClient, adSlot, adsTxt, siteConfig } from './site';

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
  it('has a guide for every exercise plus the policy pages', () => {
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
      'about',
      'privacy',
      'terms',
    ]);
  });

  it('adds AdSense, ads.txt, a sitemap and the contact page when configured', () => {
    const files = siteFiles(ADS, ASSETS, '2026-09-30');
    const file = (name: string) => files.find((f) => f.file === name)?.body ?? '';
    expect(file('ads.txt')).toContain('pub-1234567890123456');
    expect(file('robots.txt')).toContain('Sitemap: https://trackai.example/sitemap.xml');
    expect(file('sitemap.xml')).toContain('<loc>https://trackai.example/guides/squat</loc>');
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
});

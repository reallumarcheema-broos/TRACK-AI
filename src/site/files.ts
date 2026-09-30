/**
 * Every file of the public website besides the app: the content pages, /robots.txt, /ads.txt (with
 * AdSense) and /sitemap.xml (with a known address). Written after the build by
 * scripts/build-site.ts and served by the dev server (vite.config.ts).
 */
import { sitePages, type PageAssets } from './pages';
import { adsTxt, robotsTxt, sitemapXml, type SiteConfig } from './site';

export interface SiteFile {
  /** URL path without the base, e.g. "privacy" or "ads.txt". */
  path: string;
  /** Output file, e.g. "privacy.html". */
  file: string;
  body: string;
  type: string;
}

export function siteFiles(config: SiteConfig, assets: PageAssets, today: string): SiteFile[] {
  const pages = sitePages(config, assets);
  const files: SiteFile[] = pages.map((p) => ({ path: p.path, file: p.file, body: p.html, type: 'text/html; charset=utf-8' }));
  files.push({ path: 'robots.txt', file: 'robots.txt', body: robotsTxt(config.siteUrl), type: 'text/plain; charset=utf-8' });
  if (config.adsenseClient) {
    files.push({ path: 'ads.txt', file: 'ads.txt', body: adsTxt(config.adsenseClient), type: 'text/plain; charset=utf-8' });
  }
  if (config.siteUrl) {
    const root = `${config.siteUrl}${assets.base.replace(/\/$/, '')}`;
    const body = sitemapXml(root, ['', ...pages.map((p) => p.path)], today);
    files.push({ path: 'sitemap.xml', file: 'sitemap.xml', body, type: 'application/xml' });
  }
  return files;
}

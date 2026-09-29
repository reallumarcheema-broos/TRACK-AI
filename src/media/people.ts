/**
 * AI-generated people — they don't exist — for the exercise pictures and the camera-free demo.
 * Files named after an exercise id in src/assets/people (photos) and src/assets/demo (videos)
 * are picked up at build time; `npm run people` generates them.
 */
import type { ExerciseId } from '../core/exercise';

export interface VideoSources {
  /** H.264: hardware-decoded on phones, the only format older iPhones play. */
  mp4?: string;
  /** VP9: for browsers built without H.264 (some Linux Chromium builds). */
  webm?: string;
}

const split = (file: string) => {
  const name = file.slice(file.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return { id: name.slice(0, dot) as ExerciseId, ext: name.slice(dot + 1).toLowerCase() };
};

/** Maps `../assets/people/squat.jpg` → `{ squat: url }` (plus `hero` for the home page). */
export function photosById(files: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [file, url] of Object.entries(files)) out[split(file).id] = url;
  return out;
}

/** Groups `squat.mp4` and `squat.webm` into one entry per exercise. */
export function videosById(files: Record<string, string>): Partial<Record<ExerciseId, VideoSources>> {
  const out: Partial<Record<ExerciseId, VideoSources>> = {};
  for (const [file, url] of Object.entries(files)) {
    const { id, ext } = split(file);
    if (ext === 'mp4' || ext === 'webm') out[id] = { ...out[id], [ext]: url };
  }
  return out;
}

/** The first source this browser can play, MP4 first. */
export function pickSource(sources: VideoSources, canPlay: (type: string) => boolean): string | undefined {
  if (sources.mp4 && canPlay('video/mp4; codecs="avc1.640028"')) return sources.mp4;
  if (sources.webm && canPlay('video/webm; codecs="vp9"')) return sources.webm;
  return undefined;
}

const PHOTOS = photosById(
  import.meta.glob<string>('../assets/people/*.{jpg,jpeg,webp,png}', { eager: true, query: '?url', import: 'default' }),
);
const VIDEOS = videosById(import.meta.glob<string>('../assets/demo/*.{mp4,webm}', { eager: true, query: '?url', import: 'default' }));

/** `?sim` swaps the demo video for the synthetic test athlete (used by the automated tests). */
export const SIM_DEMO = typeof location !== 'undefined' && new URLSearchParams(location.search).has('sim');

export const personPhoto = (id: ExerciseId): string | undefined => PHOTOS[id];
/** The big home-page photo (`people/hero.jpg`). */
export const heroPhoto = (): string | undefined => PHOTOS.hero;

/** The demo video for an exercise in a format this browser plays, if there is one. */
export function demoVideo(id: ExerciseId): string | undefined {
  const sources = VIDEOS[id];
  if (!sources || typeof document === 'undefined') return undefined;
  const probe = document.createElement('video');
  return pickSource(sources, (type) => probe.canPlayType(type) !== '');
}

export const hasDemo = (id: ExerciseId): boolean => SIM_DEMO || demoVideo(id) !== undefined;
/** True once any AI-generated photo or video is bundled (the UI then says they're not real people). */
export const hasAiPeople = Object.keys(PHOTOS).length + Object.keys(VIDEOS).length > 0;

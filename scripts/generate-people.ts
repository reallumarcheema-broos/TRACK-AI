/**
 * Creates the app's AI people — photorealistic, fictional adults who don't exist — with Google's
 * Imagen (exercise photos) and Veo (demo videos) through the Gemini API, and prepares them for
 * the web. The app picks the files up from src/assets at build time.
 *
 *   npm run people                              # show the plan and the estimated cost, spend nothing
 *   npm run people -- --yes                     # photos + videos for every exercise
 *   npm run people -- --yes --photos            # photos only (a few cents each)
 *   npm run people -- --yes --videos squat      # one demo video
 *   npm run people -- --import squat clip.mp4   # use a photo or clip you made with another AI tool
 *
 * Needs GEMINI_API_KEY (Google AI Studio, billing enabled for Veo) and ffmpeg on PATH or in
 * FFMPEG_PATH. Behind a proxy it re-runs itself with NODE_USE_ENV_PROXY=1 (Node ≥ 22.21).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExerciseId } from '../src/core/exercise';
import { EXERCISE_BY_ID, EXERCISES } from '../src/exercises';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PHOTOS = path.join(root, 'src/assets/people');
const VIDEOS = path.join(root, 'src/assets/demo');
const CACHE = path.join(root, 'scripts/.people-cache'); // raw downloads, so re-processing never re-bills
const CREDITS = path.join(root, 'src/assets/ai-people.json');
const API = 'https://generativelanguage.googleapis.com/v1beta';

/** Rough list prices, only for the estimate printed before spending anything. */
const PRICE = { photo: 0.04, videoSecond: 0.15, videoSeconds: 8 };

interface Brief {
  /** Who: a fictional adult, described so the photo and the video look alike. */
  person: string;
  /** The pose for the photo. */
  photo: string;
  /** The movement for the video, and where each rep starts and ends. */
  video: string;
}

const BRIEFS: Record<ExerciseId, Brief> = {
  squat: {
    person: 'a woman in her late twenties with dark curly hair in a ponytail, wearing a black sports top and taupe leggings',
    photo: 'at the bottom of a bodyweight squat, thighs parallel to the floor, arms held forward for balance',
    video: 'slow bodyweight squats, standing tall between reps',
  },
  pushup: {
    person: 'a man in his thirties with short black hair and a trimmed beard, wearing a charcoal t-shirt and black shorts',
    photo: 'holding the bottom of a push-up, body in one straight line from head to heels',
    video: 'slow push-ups on the floor, arms fully straight at the top of every rep',
  },
  lunge: {
    person: 'a woman in her forties with short blonde hair, wearing an olive tank top and black leggings',
    photo: 'in a forward lunge, front thigh parallel to the floor, back knee just above the floor',
    video: 'slow alternating forward lunges, standing tall between reps',
  },
  rdl: {
    person: 'a man in his twenties with a shaved head, wearing a sand-coloured t-shirt and dark joggers, holding a dumbbell in each hand',
    photo: 'hinging forward at the hips in a Romanian deadlift with a flat back, dumbbells just below the knees',
    video: 'slow Romanian deadlifts with dumbbells, hips pushing back with a flat back, standing tall between reps',
  },
  curl: {
    person: 'a woman in her thirties with long straight black hair, wearing a rust-coloured sports top, holding a dumbbell in each hand',
    photo: 'curling both dumbbells up to the shoulders with the elbows tucked at her sides',
    video: 'slow bicep curls with both dumbbells, arms fully straight at the bottom of every rep',
  },
  press: {
    person: 'a man in his fifties with short grey hair, wearing an espresso-brown t-shirt, holding a dumbbell in each hand',
    photo: 'pressing both dumbbells overhead with straight arms',
    video: 'slow standing overhead presses with both dumbbells, lowering them to the shoulders between reps',
  },
  jumping_jack: {
    person: 'a woman in her twenties with long braided hair, wearing a cream sports top and black shorts',
    photo: 'mid jumping jack with both arms overhead and feet wide apart',
    video: 'steady jumping jacks, arms all the way overhead and feet wide on every rep',
  },
  plank: {
    person: 'a man in his thirties with wavy brown hair, wearing a stone-grey t-shirt and black leggings',
    photo: 'holding a forearm plank, body in one straight line from head to heels',
    video: 'holding a steady forearm plank for the whole clip, body in one straight line, breathing calmly',
  },
};

/** The look of every picture: matches the app's warm cream-and-espresso design. */
const SETTING =
  'in a warm minimalist studio with a soft beige backdrop and a pale wooden floor, warm golden side light, ' +
  'muted earthy tones, editorial fitness photography';

/** The big home-page photo. */
const HERO_PROMPT =
  'Photorealistic editorial fitness photograph of a fit woman in her thirties with dark hair in a low bun, wearing an ' +
  `espresso-brown sports top and matching leggings, holding a deep kneeling lunge stretch on a mat and looking ahead calmly, ${SETTING}. ` +
  'Her whole body is in the left half of the frame; the right half is empty warm backdrop. Sharp focus. No text, no logos, no watermark.';

const VIEW_TEXT = { side: 'Shown exactly from the side, in profile', front: 'Facing the camera', diagonal: 'Seen at a 45° angle' };

function photoPrompt(id: ExerciseId): string {
  const b = BRIEFS[id];
  const view = VIEW_TEXT[EXERCISE_BY_ID[id].camera.recommended];
  return (
    `Photorealistic photo of ${b.person}, ${b.photo}. ${view}. The whole body is visible from head to toe, ` +
    `centred, ${SETTING}. Sharp focus, camera at hip height about 2.5 m away. ` +
    'Plain athletic clothes without logos. No text, no watermark.'
  );
}

function videoPrompt(id: ExerciseId): string {
  const b = BRIEFS[id];
  const view = VIEW_TEXT[EXERCISE_BY_ID[id].camera.recommended];
  return (
    `A phone on a tripod at hip height, 2.5 m away, films ${b.person} doing ${b.video} ${SETTING}. ` +
    `${view}. The whole body stays in frame from head to toe for the entire clip. ` +
    'Realistic motion at a natural pace. The camera never moves; no cuts, no text, no music.'
  );
}

/** Portrait for standing exercises, landscape for floor ones — how the app tells people to hold the phone. */
const isFloor = (id: ExerciseId) => !!EXERCISE_BY_ID[id].horizontal;

// ---- Gemini API -------------------------------------------------------------------------------

const KEY = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '';

async function api<T>(pathname: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}/${pathname}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!res.ok) throw new Error(`${res.status}: ${json.error?.message ?? res.statusText}`);
  return json as T;
}

/** Newest stable model whose name matches, unless IMAGEN_MODEL / VEO_MODEL say otherwise. */
async function pickModels(): Promise<{ imagen?: string; veo?: string }> {
  const { models = [] } = await api<{ models?: { name: string }[] }>('models?pageSize=1000');
  const names = models.map((m) => m.name.replace(/^models\//, ''));
  const newest = (patterns: RegExp[]) => {
    for (const re of patterns) {
      const hits = names.filter((n) => re.test(n)).sort((a, b) => Number(/preview|exp/.test(a)) - Number(/preview|exp/.test(b)) || b.localeCompare(a));
      if (hits.length) return hits[0];
    }
    return undefined;
  };
  return {
    imagen: process.env.IMAGEN_MODEL ?? newest([/^imagen-4.*generate/, /^imagen-3.*generate/]),
    veo: process.env.VEO_MODEL ?? newest([/^veo-3.*fast/, /^veo-3/, /^veo-2/]),
  };
}

async function generatePhoto(model: string, prompt: string, aspectRatio: string): Promise<Buffer> {
  const out = await api<{ predictions?: { bytesBase64Encoded?: string }[] }>(`models/${model}:predict`, {
    instances: [{ prompt }],
    parameters: { sampleCount: 1, aspectRatio, personGeneration: 'allow_adult' },
  });
  const b64 = out.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error('no image came back (the safety filter may have blocked the prompt)');
  return Buffer.from(b64, 'base64');
}

interface Operation {
  name: string;
  done?: boolean;
  error?: { message?: string };
  response?: { generateVideoResponse?: { generatedSamples?: { video?: { uri?: string } }[]; raiMediaFilteredReasons?: string[] } };
}

async function generateVideo(model: string, id: ExerciseId): Promise<Buffer> {
  const request = (personGeneration?: string) => ({
    instances: [{ prompt: videoPrompt(id) }],
    parameters: {
      aspectRatio: isFloor(id) ? '16:9' : '9:16',
      negativePrompt: 'camera movement, zoom, cuts, text, watermark, extra people, cropped feet, cropped head',
      ...(personGeneration ? { personGeneration } : {}),
    },
  });
  // Allowed person settings differ by model and region: try the permissive one first.
  let op: Operation | undefined;
  for (const setting of ['allow_all', 'allow_adult', undefined]) {
    try {
      op = await api<Operation>(`models/${model}:predictLongRunning`, request(setting));
      break;
    } catch (err) {
      if (!/person/i.test((err as Error).message) || setting === undefined) throw err;
    }
  }
  for (let waited = 0; !op!.done; waited += 10) {
    if (waited > 900) throw new Error('timed out waiting for the video');
    await new Promise((r) => setTimeout(r, 10_000));
    process.stdout.write('.');
    op = await api<Operation>(op!.name);
  }
  if (op!.error) throw new Error(op!.error.message ?? 'video generation failed');
  const res = op!.response?.generateVideoResponse;
  const uri = res?.generatedSamples?.[0]?.video?.uri;
  if (!uri) throw new Error(`no video came back${res?.raiMediaFilteredReasons ? ` (${res.raiMediaFilteredReasons.join('; ')})` : ''}`);
  const file = await fetch(uri, { headers: { 'x-goog-api-key': KEY } });
  if (!file.ok) throw new Error(`download failed: HTTP ${file.status}`);
  return Buffer.from(await file.arrayBuffer());
}

// ---- web-ready files --------------------------------------------------------------------------

const FFMPEG = process.env.FFMPEG_PATH ?? 'ffmpeg';

function ffmpeg(args: string[]): void {
  const run = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
  if (run.error || run.status !== 0) throw new Error(`ffmpeg failed (${run.error?.message ?? `exit ${run.status}`})`);
}

/** A web-sized JPEG: cards need about 960 px, the home-page hero more. */
function makePhoto(input: string, name: string): string {
  mkdirSync(PHOTOS, { recursive: true });
  const out = path.join(PHOTOS, `${name}.jpg`);
  const width = name === 'hero' ? 1400 : 960;
  ffmpeg(['-i', input, '-vf', `scale='min(${width},iw)':-2`, '-q:v', '4', out]);
  return out;
}

/**
 * The demo video: played forwards then backwards so it loops without a jump (the tracker would
 * otherwise see the person teleport), no sound, sized for phones. Written as H.264 MP4 (phones,
 * Safari) and VP9 WebM (browsers built without H.264); the app plays whichever works.
 */
function makeVideo(input: string, id: ExerciseId): string {
  mkdirSync(VIDEOS, { recursive: true });
  const out = path.join(VIDEOS, `${id}.mp4`);
  const size = isFloor(id) ? '960:540' : '540:960';
  ffmpeg([
    '-i', input,
    '-filter_complex', `[0:v]fps=30,scale=${size}:force_original_aspect_ratio=decrease,pad=${size}:(ow-iw)/2:(oh-ih)/2,setsar=1,split[f][b];[b]reverse[r];[f][r]concat=n=2:v=1:a=0,format=yuv420p,split[v1][v2]`,
    '-map', '[v1]', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-movflags', '+faststart', out,
    '-map', '[v2]', '-an', '-c:v', 'libvpx-vp9', '-crf', '38', '-b:v', '0', '-row-mt', '1', '-cpu-used', '2', path.join(VIDEOS, `${id}.webm`),
  ]);
  return out;
}

function credit(id: string, kind: 'photo' | 'video', entry: Record<string, string>): void {
  const all = existsSync(CREDITS) ? JSON.parse(readFileSync(CREDITS, 'utf8')) : {};
  all[id] = { ...all[id], [kind]: { ...entry, note: 'AI-generated. This person does not exist.' } };
  writeFileSync(CREDITS, `${JSON.stringify(all, null, 2)}\n`);
}

// ---- main ---------------------------------------------------------------------------------------

async function main(): Promise<void> {
  // Node's fetch ignores HTTPS_PROXY unless NODE_USE_ENV_PROXY is set at startup: re-run with it.
  if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
    const rerun = spawnSync(process.execPath, [...process.execArgv, ...process.argv.slice(1)], {
      stdio: 'inherit',
      env: { ...process.env, NODE_USE_ENV_PROXY: '1' },
    });
    process.exitCode = rerun.status ?? 1;
    return;
  }
  const args = process.argv.slice(2);
  const named = args.filter((a) => !a.startsWith('--'));
  const targets: ExerciseId[] = named.length ? named.filter((a): a is ExerciseId => a in EXERCISE_BY_ID) : EXERCISES.map((e) => e.id);

  if (args[0] === '--import') {
    const [id, file] = [args[1] as ExerciseId, args[2]];
    if (!(id in EXERCISE_BY_ID) || !file || !existsSync(file)) throw new Error('usage: npm run people -- --import <exercise> <photo-or-video>');
    const isVideo = /\.(mp4|mov|webm|mkv)$/i.test(file);
    const out = isVideo ? makeVideo(file, id) : makePhoto(file, id);
    credit(id, isVideo ? 'video' : 'photo', { source: `imported ${path.basename(file)}`, date: new Date().toISOString().slice(0, 10) });
    console.log(`✓ ${path.relative(root, out)}`);
    return;
  }

  const photos = !args.includes('--videos');
  const videos = !args.includes('--photos');
  // The home-page photo comes with a full run, or ask for it by name: `npm run people -- --yes hero`.
  const hero = photos && (named.length === 0 || named.includes('hero'));
  const photoCount = (photos ? targets.length : 0) + (hero ? 1 : 0);
  const cost = photoCount * PRICE.photo + (videos ? targets.length * PRICE.videoSecond * PRICE.videoSeconds : 0);
  console.log(
    `Plan: ${[photoCount && `${photoCount} photo(s)`, videos && targets.length && `${targets.length} video(s)`].filter(Boolean).join(' + ')} ` +
      `for ${[hero && 'home page', ...targets].filter(Boolean).join(', ')}`,
  );
  console.log(`Estimated cost: about $${cost.toFixed(2)} on the Google account that owns the key.`);
  if (!args.includes('--yes')) {
    console.log('Nothing generated yet. Add --yes to go ahead.');
    return;
  }
  if (!KEY) throw new Error('Set GEMINI_API_KEY (Google AI Studio → Get API key).');
  const probe = spawnSync(FFMPEG, ['-version']);
  if (probe.error || probe.status !== 0) throw new Error('ffmpeg not found: install it or point FFMPEG_PATH at it.');

  const models = await pickModels();
  if (photoCount && !models.imagen) throw new Error('No Imagen model is available to this key.');
  if (videos && targets.length && !models.veo) throw new Error('No Veo model is available to this key (Veo needs billing enabled).');
  console.log(`Models: ${[photos && models.imagen, videos && models.veo].filter(Boolean).join(', ')}`);
  mkdirSync(CACHE, { recursive: true });

  let failed = 0;
  if (hero) {
    try {
      process.stdout.write('home page: photo… ');
      const raw = path.join(CACHE, 'hero.png');
      writeFileSync(raw, await generatePhoto(models.imagen!, HERO_PROMPT, '3:4'));
      console.log(`✓ ${path.relative(root, makePhoto(raw, 'hero'))}`);
      credit('hero', 'photo', { model: models.imagen!, prompt: HERO_PROMPT, date: new Date().toISOString().slice(0, 10) });
    } catch (err) {
      failed++;
      console.log(`✗ ${(err as Error).message}`);
    }
  }
  for (const id of targets) {
    const date = new Date().toISOString().slice(0, 10);
    if (photos) {
      try {
        process.stdout.write(`${id}: photo… `);
        const raw = path.join(CACHE, `${id}.png`);
        writeFileSync(raw, await generatePhoto(models.imagen!, photoPrompt(id), '4:3'));
        console.log(`✓ ${path.relative(root, makePhoto(raw, id))}`);
        credit(id, 'photo', { model: models.imagen!, prompt: photoPrompt(id), date });
      } catch (err) {
        failed++;
        console.log(`✗ ${(err as Error).message}`);
      }
    }
    if (videos) {
      try {
        process.stdout.write(`${id}: video (takes a minute or two)`);
        const raw = path.join(CACHE, `${id}.mp4`);
        writeFileSync(raw, await generateVideo(models.veo!, id));
        console.log(` ✓ ${path.relative(root, makeVideo(raw, id))}`);
        credit(id, 'video', { model: models.veo!, prompt: videoPrompt(id), date });
      } catch (err) {
        failed++;
        console.log(` ✗ ${(err as Error).message}`);
      }
    }
  }
  console.log(failed ? `${failed} item(s) failed — run again for just those exercises.` : 'Done. Rebuild the app to include them.');
  process.exitCode = failed ? 1 : 0;
}

main().catch((err) => {
  console.error(`✗ ${(err as Error).message}`);
  process.exitCode = 1;
});

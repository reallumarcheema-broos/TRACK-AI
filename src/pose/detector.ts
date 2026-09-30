/**
 * On-device body tracking with MediaPipe Pose Landmarker (BlazePose GHUM, 33 landmarks).
 * Frames never leave the device: the model and WASM runtime run in the browser.
 */
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import type { Landmark, PoseInput } from '../core/landmarks';

export type ModelQuality = 'lite' | 'full' | 'heavy';

const BASE = import.meta.env.BASE_URL;
const WASM_PATH = `${BASE}mediapipe/wasm`;
const LOCAL_MODEL = (q: ModelQuality) => `${BASE}models/pose_landmarker_${q}.task`;
const REMOTE_MODEL = (q: ModelQuality) =>
  `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${q}/float16/latest/pose_landmarker_${q}.task`;

export interface LoadProgress {
  stage: 'runtime' | 'model' | 'init';
  /** 0..1 when known. */
  fraction: number | null;
}

/** Downloads a file, reporting progress. Rejects HTML (an SPA fallback page) and tiny files. */
async function download(url: string, onProgress?: (f: number | null) => void): Promise<Uint8Array> {
  const res = await fetch(url);
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok || type.includes('html')) throw new Error(`Model not available at ${url} (${res.status})`);
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body) {
    const buf = new Uint8Array(await res.arrayBuffer());
    onProgress?.(1);
    return buf;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress?.(total ? Math.min(1, received / total) : null);
  }
  const out = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  if (out.length < 500_000) throw new Error(`Model download from ${url} looks truncated`);
  return out;
}

const modelCache = new Map<ModelQuality, Promise<Uint8Array>>();

function loadModel(quality: ModelQuality, onProgress?: (f: number | null) => void): Promise<Uint8Array> {
  let p = modelCache.get(quality);
  if (!p) {
    p = download(LOCAL_MODEL(quality), onProgress).catch(() => download(REMOTE_MODEL(quality), onProgress));
    p.catch(() => modelCache.delete(quality));
    modelCache.set(quality, p);
  }
  return p;
}

/** Sensible default: the lighter model on phones, the more accurate one on desktops. */
export function defaultQuality(): ModelQuality {
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  return mobile ? 'lite' : 'full';
}

type WasmFileset = Awaited<ReturnType<typeof import('@mediapipe/tasks-vision').FilesetResolver.forVisionTasks>>;

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

/** Frames to time before deciding whether the GPU delegate is actually the faster one. */
const TUNE_SAMPLES = 10;
/** Below this per-frame cost the GPU is clearly fine; don't bother trying the CPU. */
const GPU_GOOD_ENOUGH_MS = 70;

export class PoseDetector {
  private lastTs = 0;
  private timings: number[] = [];
  private tuning: 'pending' | 'running' | 'done' = 'pending';
  private closed = false;

  private constructor(
    private landmarker: PoseLandmarker,
    readonly quality: ModelQuality,
    public delegate: 'GPU' | 'CPU',
    private readonly fileset: WasmFileset,
    private readonly model: Uint8Array,
  ) {
    if (delegate === 'CPU') this.tuning = 'done';
  }

  private static async build(fileset: WasmFileset, model: Uint8Array, delegate: 'GPU' | 'CPU'): Promise<PoseLandmarker> {
    const { PoseLandmarker } = await import('@mediapipe/tasks-vision');
    return PoseLandmarker.createFromOptions(fileset, {
      // MediaPipe copies the buffer into WASM memory; pass a copy so it can be reused.
      baseOptions: { modelAssetBuffer: model.slice(), delegate },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  }

  static async create(quality: ModelQuality, onProgress?: (p: LoadProgress) => void): Promise<PoseDetector> {
    onProgress?.({ stage: 'runtime', fraction: null });
    // Loaded on demand so the home screen doesn't pay for the vision runtime.
    const { FilesetResolver } = await import('@mediapipe/tasks-vision');
    const [fileset, model] = await Promise.all([
      FilesetResolver.forVisionTasks(WASM_PATH),
      loadModel(quality, (fraction) => onProgress?.({ stage: 'model', fraction })),
    ]);
    onProgress?.({ stage: 'init', fraction: null });
    let lastError: unknown;
    for (const delegate of ['GPU', 'CPU'] as const) {
      try {
        const landmarker = await PoseDetector.build(fileset, model, delegate);
        return new PoseDetector(landmarker, quality, delegate, fileset, model);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Could not start the pose model');
  }

  /** Detects the most prominent person in a video frame. Returns null when nobody is visible. */
  detect(video: HTMLVideoElement, timestampMs: number): PoseInput | null {
    const t0 = performance.now();
    const result = this.landmarker.detectForVideo(video, this.nextTs(timestampMs));
    this.tune(performance.now() - t0, video);
    const image = result.landmarks[0];
    const world = result.worldLandmarks[0];
    if (!image || !world || image.length < 33) return null;
    const copy = (l: { x: number; y: number; z: number; visibility?: number }): Landmark => ({
      x: l.x,
      y: l.y,
      z: l.z,
      visibility: l.visibility ?? 1,
    });
    return { image: image.map(copy), world: world.map(copy) };
  }

  /** MediaPipe requires strictly increasing timestamps. */
  private nextTs(ts: number): number {
    this.lastTs = Math.max(ts, this.lastTs + 1);
    return this.lastTs;
  }

  /**
   * WebGL quality varies wildly between devices (and is emulated in some browsers), so after
   * a few frames on the GPU we try the CPU (WASM SIMD) delegate and keep whichever is faster.
   */
  private tune(ms: number, video: HTMLVideoElement): void {
    if (this.tuning !== 'pending') return;
    this.timings.push(ms);
    if (this.timings.length < TUNE_SAMPLES) return;
    const gpuMs = median(this.timings.slice(3));
    if (gpuMs < GPU_GOOD_ENOUGH_MS) {
      this.tuning = 'done';
      return;
    }
    this.tuning = 'running';
    PoseDetector.build(this.fileset, this.model, 'CPU').then(
      (cpu) => {
        // The set may have ended while the CPU model loaded, leaving a stopped video with no
        // frame to time (MediaPipe errors on it): drop the trial and run it again next set.
        if (this.closed || video.readyState < 2 || video.videoWidth === 0) {
          cpu.close();
          this.timings = [];
          this.tuning = this.closed ? 'done' : 'pending';
          return;
        }
        let faster = false;
        try {
          const samples: number[] = [];
          for (let i = 0; i < 4; i++) {
            const t0 = performance.now();
            cpu.detectForVideo(video, this.nextTs(this.lastTs));
            samples.push(performance.now() - t0);
          }
          faster = median(samples.slice(1)) < gpuMs * 0.8;
        } catch {
          faster = false;
        }
        if (faster) {
          const gpu = this.landmarker;
          this.landmarker = cpu;
          this.delegate = 'CPU';
          gpu.close();
        } else {
          cpu.close();
        }
        this.tuning = 'done';
      },
      () => {
        this.tuning = 'done';
      },
    );
  }

  close(): void {
    this.closed = true;
    this.landmarker.close();
  }
}

/** One detector per app session: the model takes seconds to load, so reuse it across sets. */
let shared: { quality: ModelQuality; promise: Promise<PoseDetector> } | null = null;

export function getDetector(quality: ModelQuality, onProgress?: (p: LoadProgress) => void): Promise<PoseDetector> {
  if (shared && shared.quality === quality) return shared.promise;
  if (shared) void shared.promise.then((d) => d.close()).catch(() => {});
  const promise = PoseDetector.create(quality, onProgress);
  promise.catch(() => {
    if (shared?.promise === promise) shared = null;
  });
  shared = { quality, promise };
  return promise;
}

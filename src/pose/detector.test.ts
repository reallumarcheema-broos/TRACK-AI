import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PoseDetector } from './detector';

interface FakeLandmarker {
  delegate: 'GPU' | 'CPU';
  detectForVideo: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

// A fake MediaPipe whose GPU delegate is slow (120 ms a frame) and CPU delegate fast (20 ms).
const h = vi.hoisted(() => ({ built: [] as FakeLandmarker[], clock: 0, cpuThrows: false }));
vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: async () => ({}) },
  PoseLandmarker: {
    createFromOptions: async (_fileset: unknown, opts: { baseOptions: { delegate: 'GPU' | 'CPU' } }) => {
      const { delegate } = opts.baseOptions;
      const landmarker: FakeLandmarker = {
        delegate,
        detectForVideo: vi.fn(() => {
          if (delegate === 'CPU' && h.cpuThrows) throw new Error('no frame');
          h.clock += delegate === 'GPU' ? 120 : 20;
          return { landmarks: [], worldLandmarks: [] };
        }),
        close: vi.fn(),
      };
      h.built.push(landmarker);
      return landmarker;
    },
  },
}));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const liveVideo = () => ({ readyState: 4, videoWidth: 640 }) as unknown as HTMLVideoElement;

/** Enough frames on the slow GPU to start a CPU trial. */
function runFrames(detector: PoseDetector, video: HTMLVideoElement) {
  for (let i = 0; i < 10; i++) detector.detect(video, h.clock);
}

describe('PoseDetector GPU/CPU tuning', () => {
  beforeEach(() => {
    h.built.length = 0;
    h.cpuThrows = false;
    vi.stubGlobal('fetch', async () => new Response(new Uint8Array(600_000)));
    vi.spyOn(performance, 'now').mockImplementation(() => h.clock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('switches to the CPU when it is clearly faster, and releases the GPU model', async () => {
    const detector = await PoseDetector.create('lite');
    expect(detector.delegate).toBe('GPU');
    runFrames(detector, liveVideo());
    await flush();
    const [gpu, cpu] = h.built;
    expect(cpu.delegate).toBe('CPU');
    expect(cpu.detectForVideo).toHaveBeenCalledTimes(4);
    expect(detector.delegate).toBe('CPU');
    expect(gpu.close).toHaveBeenCalled();
  });

  it('never runs the trial on a stopped camera, and retries next set', async () => {
    const detector = await PoseDetector.create('lite');
    const video = liveVideo();
    runFrames(detector, video);
    // The set ends while the CPU model is still loading: the camera stops.
    Object.assign(video, { readyState: 0, videoWidth: 0 });
    await flush();
    const firstTrial = h.built[1];
    expect(firstTrial.detectForVideo).not.toHaveBeenCalled();
    expect(firstTrial.close).toHaveBeenCalled();
    expect(detector.delegate).toBe('GPU');

    runFrames(detector, liveVideo());
    await flush();
    expect(h.built[2].detectForVideo).toHaveBeenCalledTimes(4);
    expect(detector.delegate).toBe('CPU');
  });

  it('releases a CPU model whose trial fails and keeps the GPU', async () => {
    const detector = await PoseDetector.create('lite');
    h.cpuThrows = true;
    runFrames(detector, liveVideo());
    await flush();
    const [gpu, cpu] = h.built;
    expect(cpu.close).toHaveBeenCalled();
    expect(gpu.close).not.toHaveBeenCalled();
    expect(detector.delegate).toBe('GPU');
  });
});

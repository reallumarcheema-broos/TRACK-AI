import { LANDMARK_COUNT, type Landmark, type PoseInput } from './landmarks';

/**
 * One Euro filter (Casiez et al., CHI 2012): an adaptive low-pass filter that removes
 * jitter when a signal is slow and reduces lag when it moves fast. Timestamps are in ms.
 */
export class OneEuroFilter {
  private x: number | null = null;
  private dx = 0;
  private lastT: number | null = null;

  constructor(
    private readonly minCutoff = 1.0,
    private readonly beta = 0.0,
    private readonly dCutoff = 1.0,
  ) {}

  private static alpha(cutoff: number, dtSec: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dtSec);
  }

  filter(value: number, tMs: number): number {
    if (this.x === null || this.lastT === null) {
      this.x = value;
      this.lastT = tMs;
      return value;
    }
    const dt = Math.max(1e-3, (tMs - this.lastT) / 1000);
    this.lastT = tMs;
    const rawDx = (value - this.x) / dt;
    this.dx += OneEuroFilter.alpha(this.dCutoff, dt) * (rawDx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += OneEuroFilter.alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }

  reset(): void {
    this.x = null;
    this.dx = 0;
    this.lastT = null;
  }
}

export interface SmootherOptions {
  minCutoff: number;
  beta: number;
  /** Reset the filters when no pose has been seen for this long (ms). */
  resetAfterMs: number;
}

const DEFAULTS: SmootherOptions = { minCutoff: 1.5, beta: 6, resetAfterMs: 600 };

/** Smooths every coordinate of both image and world landmarks with independent One Euro filters. */
export class PoseSmoother {
  private readonly opts: SmootherOptions;
  private filters: OneEuroFilter[] = [];
  private visFilters: OneEuroFilter[] = [];
  private lastT = -Infinity;

  constructor(opts: Partial<SmootherOptions> = {}) {
    this.opts = { ...DEFAULTS, ...opts };
    this.reset();
  }

  reset(): void {
    const { minCutoff, beta } = this.opts;
    // 33 landmarks × (image xyz + world xyz)
    this.filters = Array.from({ length: LANDMARK_COUNT * 6 }, () => new OneEuroFilter(minCutoff, beta, 1));
    this.visFilters = Array.from({ length: LANDMARK_COUNT }, () => new OneEuroFilter(3, 0, 1));
  }

  smooth(pose: PoseInput, tMs: number): PoseInput {
    if (tMs - this.lastT > this.opts.resetAfterMs) this.reset();
    this.lastT = tMs;
    const image: Landmark[] = new Array(LANDMARK_COUNT);
    const world: Landmark[] = new Array(LANDMARK_COUNT);
    for (let i = 0; i < LANDMARK_COUNT; i++) {
      const im = pose.image[i];
      const wo = pose.world[i];
      const f = i * 6;
      const visibility = this.visFilters[i].filter(im.visibility, tMs);
      image[i] = {
        x: this.filters[f].filter(im.x, tMs),
        y: this.filters[f + 1].filter(im.y, tMs),
        z: this.filters[f + 2].filter(im.z, tMs),
        visibility,
      };
      world[i] = {
        x: this.filters[f + 3].filter(wo.x, tMs),
        y: this.filters[f + 4].filter(wo.y, tMs),
        z: this.filters[f + 5].filter(wo.z, tMs),
        visibility,
      };
    }
    return { image, world };
  }
}

import { describe, expect, it } from 'vitest';
import { Priority, VoiceQueue, type SpeechEngine } from './voice';

/** Records what was said; lines finish when the test calls `end()`. */
export class FakeEngine implements SpeechEngine {
  readonly available = true;
  said: string[] = [];
  cancelled = 0;
  private done: (() => void) | null = null;
  speak(text: string, onDone: () => void): void {
    this.said.push(text);
    this.done = onDone;
  }
  cancel(): void {
    this.cancelled++;
    const d = this.done;
    this.done = null;
    d?.();
  }
  end(): void {
    const d = this.done;
    this.done = null;
    d?.();
  }
}

function setup() {
  let now = 0;
  const engine = new FakeEngine();
  const q = new VoiceQueue(engine, () => now);
  return { engine, q, advance: (ms: number) => (now += ms) };
}

describe('VoiceQueue', () => {
  it('speaks immediately when idle and queues while busy', () => {
    const { engine, q } = setup();
    q.speak('One.', { priority: Priority.count });
    q.speak('Knees out', { priority: Priority.correction });
    expect(engine.said).toEqual(['One.']);
    engine.end();
    expect(engine.said).toEqual(['One.', 'Knees out']);
  });

  it('plays the most important queued line first', () => {
    const { engine, q } = setup();
    q.speak('Welcome', { priority: Priority.chatter });
    q.speak('Nice!', { priority: Priority.chatter });
    q.speak('Two.', { priority: Priority.count });
    engine.end();
    expect(engine.said[1]).toBe('Two.');
  });

  it('keeps only the latest line per key', () => {
    const { engine, q } = setup();
    q.speak('Step back', { priority: Priority.guidance });
    q.speak('One.', { priority: Priority.count, key: 'count' });
    q.speak('Two.', { priority: Priority.count, key: 'count' });
    engine.end();
    engine.end();
    expect(engine.said).toEqual(['Step back', 'Two.']);
  });

  it('drops lines that went stale while waiting', () => {
    const { engine, q, advance } = setup();
    q.speak('Setup line', { priority: Priority.guidance });
    q.speak('Knees out', { priority: Priority.correction, ttlMs: 1500 });
    advance(2000);
    engine.end();
    expect(engine.said).toEqual(['Setup line']);
  });

  it('lets urgent lines interrupt less important ones', () => {
    const { engine, q } = setup();
    q.speak('Step back so I can see you', { priority: Priority.guidance });
    q.speak("Got you! Let's go.", { priority: Priority.urgent, interrupt: true });
    expect(engine.cancelled).toBe(1);
    expect(engine.said).toEqual(['Step back so I can see you', "Got you! Let's go."]);
  });

  it('does not interrupt an equally important line', () => {
    const { engine, q } = setup();
    q.speak('Three.', { priority: Priority.count });
    q.speak('Four.', { priority: Priority.count, interrupt: true });
    expect(engine.cancelled).toBe(0);
    engine.end();
    expect(engine.said).toEqual(['Three.', 'Four.']);
  });

  it('recovers when the engine never reports the end of a line', () => {
    const { engine, q, advance } = setup();
    q.speak('Stuck line', { priority: Priority.count });
    q.speak('Next', { priority: Priority.count, ttlMs: 20000 });
    advance(9000);
    q.tick();
    expect(engine.said).toEqual(['Stuck line', 'Next']);
  });

  it('is silent when muted', () => {
    const { engine, q } = setup();
    q.muted = true;
    q.speak('One.', { priority: Priority.count });
    expect(engine.said).toEqual([]);
  });
});

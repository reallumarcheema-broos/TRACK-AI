/** Keeps the screen on while a set is running (the phone is propped up, nobody touches it). */
export class ScreenWakeLock {
  private sentinel: WakeLockSentinel | null = null;
  private wanted = false;

  private readonly onVisibility = () => {
    if (this.wanted && document.visibilityState === 'visible' && !this.sentinel) void this.acquire();
  };

  async enable(): Promise<void> {
    this.wanted = true;
    document.addEventListener('visibilitychange', this.onVisibility);
    await this.acquire();
  }

  async disable(): Promise<void> {
    this.wanted = false;
    document.removeEventListener('visibilitychange', this.onVisibility);
    const s = this.sentinel;
    this.sentinel = null;
    await s?.release().catch(() => {});
  }

  private async acquire(): Promise<void> {
    try {
      if (!('wakeLock' in navigator)) return;
      this.sentinel = await navigator.wakeLock.request('screen');
      this.sentinel.addEventListener('release', () => {
        this.sentinel = null;
      });
    } catch {
      // Not supported, or denied (e.g. low battery) — the set still works.
      this.sentinel = null;
    }
  }
}

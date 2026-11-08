const MAX_ENTRIES = 512;
const MAX_KEY_LENGTH = 8192;

/** Bounded reuse of DOM fitting while the document's font set is unchanged. */
export class TextFitCache {
  private readonly sizes = new Map<string, number>();
  private fontsReady: Promise<unknown> | undefined;

  fit(
    key: string,
    measure: () => number,
    fonts?: {
      readonly ready: Promise<unknown>;
      readonly status: 'loading' | 'loaded';
    },
  ): number {
    if (this.fontsReady !== fonts?.ready) {
      this.sizes.clear();
      this.fontsReady = fonts?.ready;
    }
    if (fonts?.status === 'loading' || key.length > MAX_KEY_LENGTH) {
      return measure();
    }
    const cached = this.sizes.get(key);
    if (cached !== undefined) {
      this.sizes.delete(key);
      this.sizes.set(key, cached);
      return cached;
    }
    const size = measure();
    this.sizes.set(key, size);
    if (this.sizes.size > MAX_ENTRIES) {
      const oldest = this.sizes.keys().next().value;
      if (oldest !== undefined) this.sizes.delete(oldest);
    }
    return size;
  }
}

import {
  parseFontCatalog,
  type FontCatalog,
  type FontCatalogSnapshot,
} from '@core/schema/fontCatalog';
import type {Logger} from '../log';
import type {SavedFontCatalog} from './catalogFile';

const REFRESH_MS = 60_000;
const RETRY_MS = 10_000;

/** Serves disk choices immediately, verifies stamps, and publishes refreshes without false negatives. */
export class FontCatalogCache {
  private value: FontCatalogSnapshot = {families: [], verified: false};
  private saved: SavedFontCatalog | null = null;
  private readonly initialized: Promise<void>;
  private pending: Promise<void> | undefined;
  private readonly controller = new AbortController();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private closed = false;

  constructor(
    private readonly options: {
      readonly load: () => Promise<SavedFontCatalog | null>;
      readonly save: (value: SavedFontCatalog) => Promise<void>;
      readonly stamp: (signal: AbortSignal) => Promise<string>;
      readonly read: (signal: AbortSignal) => Promise<FontCatalog>;
      readonly changed: (value: FontCatalogSnapshot) => void;
      readonly log: Pick<Logger, 'warn'>;
      readonly ready?: Promise<boolean>;
    },
  ) {
    this.initialized = this.load();
  }

  async snapshot(): Promise<FontCatalogSnapshot> {
    await this.initialized;
    if (this.closed) throw Error('Font catalog is closed');
    if (this.timer === undefined) this.refresh();
    return this.value;
  }

  async get(): Promise<FontCatalog> {
    await this.snapshot();
    await this.pending;
    if (this.closed) throw Error('Font catalog is closed');
    if (!this.value.verified) throw Error('Could not verify installed fonts');
    return this.value.families;
  }

  dispose(): void {
    this.closed = true;
    clearTimeout(this.timer);
    this.controller.abort();
  }

  private async load(): Promise<void> {
    try {
      const saved = await this.options.load();
      if (this.closed) return;
      this.saved = saved;
      if (saved !== null) {
        this.value = {families: saved.families, verified: false};
      }
    } catch (error) {
      this.options.log.warn('Could not read the saved font catalog', error);
    }
  }

  private publish(value: FontCatalogSnapshot): void {
    if (this.closed) return;
    this.value = value;
    this.options.changed(value);
  }

  private refresh(): void {
    if (this.closed || this.pending !== undefined) return;
    this.pending = this.verify().finally(() => {
      this.pending = undefined;
    });
  }

  private async verify(): Promise<void> {
    if (this.options.ready !== undefined && !(await this.options.ready)) return;
    if (this.isClosed()) return;
    let delay = REFRESH_MS;
    try {
      const stamp = await this.options.stamp(this.controller.signal);
      if (this.closed) return;
      if (this.saved?.stamp === stamp) {
        if (!this.value.verified) {
          this.publish({families: this.saved.families, verified: true});
        }
        return;
      }
      if (this.value.verified) this.publish({...this.value, verified: false});
      const parsed = parseFontCatalog(
        await this.options.read(this.controller.signal),
      );
      if (!parsed.ok) throw Error('Invalid installed font metadata');
      const after = await this.options.stamp(this.controller.signal);
      if (this.controller.signal.aborted) return;
      if (stamp !== after) throw Error('Fonts changed during enumeration');
      this.saved = {stamp, families: parsed.value};
      this.publish({families: parsed.value, verified: true});
      await this.options.save(this.saved);
    } catch (error) {
      if (!this.closed) {
        if (this.value.verified) this.publish({...this.value, verified: false});
        this.options.log.warn('Could not refresh the font catalog', error);
      }
      delay = RETRY_MS;
    } finally {
      if (!this.closed) {
        this.timer = setTimeout(() => {
          this.timer = undefined;
          this.refresh();
        }, delay);
        this.timer.unref();
      }
    }
  }

  private isClosed(): boolean {
    return this.closed;
  }
}

import {
  parseAppConfig,
  serializeAppConfig,
  type AppConfig,
} from '@shared/schema/appConfig';
import {
  parseLayoutChange,
  type LayoutChange,
  type UiState,
} from '@shared/schema/uiState';
import type {Logger} from '../log';

const DEFAULT_DEBOUNCE_MS = 500;

/** Reads and writes the `app.json` text. */
export interface UiStateIo {
  /** Resolves to null when the file does not exist. */
  read(file: string): Promise<string | null>;
  /** Replaces the file in one step. */
  write(file: string, text: string): Promise<void>;
}

export interface UiStateStoreOptions {
  readonly file: string;
  readonly io: UiStateIo;
  readonly log: Logger;
  readonly debounceMs?: number;
}

function emptyConfig(): AppConfig {
  return {format: 'llapp', schemaVersion: 1};
}

function withLayoutChange(
  config: AppConfig,
  {sizeClass, left, right}: LayoutChange,
): AppConfig {
  const layout = config.layout ?? {};
  return {
    ...config,
    layout: {...layout, [sizeClass]: {...layout[sizeClass], left, right}},
  };
}

/**
 * Keeps the UI state of `app.json` and writes it back. The widths a drag sets
 * are merged into `layout.<size class>`, other fields stay as they are, and a
 * burst of changes becomes one write.
 *
 * It never replaces a file it could not read: a broken file, or one from a
 * newer app version, stays untouched, and the changes of that session live in
 * memory only.
 */
export class UiStateStore {
  private config: AppConfig = emptyConfig();
  private fileIsSafeToWrite = true;
  private dirty = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private writing: Promise<void> = Promise.resolve();

  constructor(private readonly options: UiStateStoreOptions) {}

  /** The UI state for the control window. */
  get state(): UiState {
    const {layout} = this.config;
    return layout ? {layout} : {};
  }

  async load(): Promise<void> {
    const {file, io, log} = this.options;
    let text: string | null;
    try {
      text = await io.read(file);
    } catch (error) {
      this.keepFileUntouched('could not read app.json', error);
      return;
    }
    if (text === null) return;
    const parsed = parseAppConfig(text, file);
    if (!parsed.ok) {
      this.keepFileUntouched('app.json is not usable', parsed.error);
      return;
    }
    if (parsed.value.access === 'readOnly') {
      log.warn('app.json comes from a newer app version', {file});
      this.fileIsSafeToWrite = false;
    }
    this.config = parsed.value.data;
  }

  /** Merges the widths of a size class. Invalid values are logged and dropped. */
  setLayout(value: unknown): void {
    const change = parseLayoutChange(value);
    if (!change.ok) {
      this.options.log.warn('dropped a malformed layout change', change.error);
      return;
    }
    this.config = withLayoutChange(this.config, change.value);
    this.dirty = true;
    this.scheduleWrite();
  }

  /** Writes pending changes now. Call it before quitting. */
  async flush(): Promise<void> {
    this.cancelTimer();
    this.writing = this.writing.then(() => this.writeIfDirty());
    await this.writing;
  }

  dispose(): void {
    this.cancelTimer();
  }

  private keepFileUntouched(message: string, detail: unknown): void {
    this.options.log.warn(message, detail);
    this.fileIsSafeToWrite = false;
  }

  private scheduleWrite(): void {
    if (!this.fileIsSafeToWrite) return;
    this.cancelTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush().catch((error: unknown) =>
        this.options.log.error('could not save app.json', error),
      );
    }, this.options.debounceMs ?? DEFAULT_DEBOUNCE_MS);
  }

  private cancelTimer(): void {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
  }

  private async writeIfDirty(): Promise<void> {
    if (!this.dirty || !this.fileIsSafeToWrite) return;
    const {file, io, log} = this.options;
    const text = serializeAppConfig(this.config, file);
    if (!text.ok) {
      log.error('could not serialize app.json', text.error);
      return;
    }
    this.dirty = false;
    try {
      await io.write(file, text.value);
    } catch (error) {
      this.dirty = true;
      log.error('could not save app.json', error);
    }
  }
}

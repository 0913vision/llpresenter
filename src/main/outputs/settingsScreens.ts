import {MAX_TARGET_SCREENS} from '@shared/schema/overlayState';
import type {Screen} from '@shared/schema/screens';
import type {ScreenId} from '@shared/schema/ids';
import type {SettingsReader} from '../store/settingsStore';
import type {Logger} from '../log';
import {MissingLiveTargetError} from '../live/commandErrors';
import {outputStateKeys} from './identity';
import type {OutputScreen, ScreenSource} from './screens';

export interface SettingsScreens extends ScreenSource {
  readonly ready: boolean;
  subscribe(listener: () => void): () => void;
  resync(screenId: ScreenId): void;
  dispose(): void;
}

function savedScreens(reader: SettingsReader): readonly Screen[] {
  const document = reader.get('screens');
  if (document.name !== 'screens') {
    throw new Error('Screen settings are unavailable');
  }
  if (document.value.screens.length > MAX_TARGET_SCREENS) {
    throw new Error('Too many output screens');
  }
  return document.value.screens;
}

function outputScreens(reader: SettingsReader): readonly OutputScreen[] {
  const onDisconnect = reader.preferences().onDisconnect;
  return savedScreens(reader).flatMap(screen => {
    if (screen.method === 'ndi') return [];
    return [
      {
        id: screen.id,
        name: screen.name,
        method: screen.method,
        display: screen.display ?? null,
        aliases: outputStateKeys(screen.id).slice(1),
        onDisconnect: screen.onDisconnect ?? onDisconnect,
        alwaysOnTop: screen.alwaysOnTop ?? screen.method === 'fullscreen',
        ...(screen.resolution === undefined
          ? {}
          : {resolution: screen.resolution}),
      },
    ];
  });
}

class SavedScreenSource implements SettingsScreens {
  ready = false;
  private reader: SettingsReader | null = null;
  private current: readonly OutputScreen[] = [];
  private disposed = false;
  private pending = false;
  private unsubscribe: (() => void) | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(
    loading: Promise<SettingsReader | null>,
    private readonly log: Logger,
  ) {
    void loading
      .then(reader => {
        if (this.disposed) return;
        this.reader = reader;
        this.unsubscribe =
          reader?.subscribe(document => {
            if (
              document.name === 'screens' ||
              document.name === 'preferences'
            ) {
              this.refresh();
            }
          }) ?? null;
        this.refresh();
      })
      .catch((error: unknown) => {
        if (this.disposed) return;
        log.error('could not connect output screen settings', error);
        this.ready = true;
        this.notify();
      });
  }

  list(): readonly OutputScreen[] {
    return this.current;
  }

  subscribe(listener: () => void): () => void {
    if (!this.disposed) this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  resync(screenId: ScreenId): void {
    if (this.disposed || this.reader === null) {
      throw new Error('Output settings are not ready');
    }
    if (!savedScreens(this.reader).some(screen => screen.id === screenId)) {
      throw new MissingLiveTargetError({kind: 'screen', id: screenId});
    }
    if (this.pending) return;
    this.pending = true;
    queueMicrotask(() => {
      this.pending = false;
      this.refresh();
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.listeners.clear();
    this.current = [];
    this.reader = null;
  }

  private refresh(): void {
    if (this.disposed) return;
    try {
      this.current = this.reader === null ? [] : outputScreens(this.reader);
    } catch (error) {
      this.log.error('could not read output screen settings', error);
    }
    this.ready = true;
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (error) {
        this.log.error('screen settings listener failed', error);
      }
    }
  }
}

/** Follows saved screen settings and keeps the last good configuration. */
export function createSettingsScreenSource(
  loading: Promise<SettingsReader | null>,
  log: Logger,
): SettingsScreens {
  return new SavedScreenSource(loading, log);
}

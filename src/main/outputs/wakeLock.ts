import type {LiveState} from '@shared/live';
import type {LiveStore} from '../live/store';
import type {Logger} from '../log';

/** Keeps the display and the system awake: Electron's `powerSaveBlocker` in the app. */
export interface WakeLock {
  /**
   * Starts keeping them awake.
   *
   * @returns A function that stops it.
   */
  acquire(): () => void;
}

/**
 * Holds at most one wake lock: takes it when needed and releases it when not.
 * A lock whose release fails stays held, and the next update or dispose tries
 * the release again.
 */
export class WakeKeeper {
  private release: (() => void) | null = null;

  constructor(
    private readonly lock: WakeLock,
    private readonly log: Logger,
  ) {}

  get held(): boolean {
    return this.release !== null;
  }

  update(needed: boolean): void {
    if (needed && this.release === null) this.acquire();
    else if (!needed && this.release !== null) this.letGo();
  }

  dispose(): void {
    if (this.release !== null) this.letGo();
  }

  private acquire(): void {
    try {
      this.release = this.lock.acquire();
      this.log.info('keeping the display awake while outputs are on');
    } catch (error) {
      this.log.error('could not keep the display awake', error);
    }
  }

  private letGo(): void {
    const release = this.release;
    if (release === null) return;
    try {
      release();
    } catch (error) {
      // NOTE(0913vision): The lock stays ours, so the next update or dispose
      // tries again instead of taking a second one.
      this.log.error('could not let the display sleep again', error);
      return;
    }
    this.release = null;
    this.log.info('letting the display sleep again');
  }
}

function anyOutputOn({outputs}: LiveState): boolean {
  return Object.values(outputs).some(on => on);
}

/**
 * Keeps the display and the system awake while any screen output is on, and
 * lets them sleep once the last one turns off. There is no setting: no
 * service is better with sleep allowed (docs/spec/10-shortcuts-and-settings.md,
 * prevent sleep).
 *
 * @returns A function that stops following the outputs and releases the lock.
 */
export function keepAwakeWhileOutputsOn(
  store: LiveStore,
  keeper: WakeKeeper,
): () => void {
  // NOTE(0913vision): A listener before this one can dispatch while a change
  // is still being announced, so the announced state can be stale. The store's
  // current state is always the latest.
  const update = (): void => keeper.update(anyOutputOn(store.state));
  update();
  const unsubscribe = store.subscribe(update);
  return () => {
    unsubscribe();
    keeper.dispose();
  };
}

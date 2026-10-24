import type {Rect} from '../displays/rect';
import type {
  CreateOutputWindowHandle,
  OutputWindowEvents,
  OutputWindowHandle,
} from './outputWindow';
import type {OutputScreen} from './screens';

/**
 * What a fake window was told to show: nothing, full screen on a monitor, or a
 * normal window moved to the bounds (null when it stays where it is).
 */
export type FakeMode =
  | {readonly kind: 'hidden'}
  | {
      readonly kind: 'fullscreen';
      readonly bounds: Rect;
      readonly alwaysOnTop: boolean;
    }
  | {readonly kind: 'window'; readonly bounds: Rect | null};

/** An output window handle that records what it was told to do. */
export class FakeOutputHandle implements OutputWindowHandle {
  mode: FakeMode = {kind: 'hidden'};
  rendererGone = false;
  destroyed = false;
  reloads = 0;
  /** Makes the next reload fail to load the page. */
  failNextReload = false;
  forcedCrashes = 0;
  /** Every call that showed the window, in order. */
  readonly placements: FakeMode[] = [];

  constructor(
    readonly screen: OutputScreen,
    private readonly events: OutputWindowEvents,
  ) {}

  showFullScreen(bounds: Rect, alwaysOnTop: boolean): void {
    this.place({kind: 'fullscreen', bounds, alwaysOnTop});
  }

  showWindowed(bounds: Rect | null): void {
    this.place({kind: 'window', bounds});
  }

  hide(): void {
    this.mode = {kind: 'hidden'};
  }

  reload(): Promise<void> {
    this.reloads += 1;
    this.rendererGone = false;
    if (!this.failNextReload) return Promise.resolve();
    this.failNextReload = false;
    return Promise.reject(new Error('ERR_FAILED'));
  }

  crashRenderer(): void {
    this.forcedCrashes += 1;
  }

  destroy(): void {
    this.destroyed = true;
  }

  /** Kills the renderer as a crash would. */
  crash(reason = 'crashed', exitCode = 1): void {
    this.rendererGone = true;
    this.events.onRendererGone({reason, exitCode});
  }

  /** Clicks the window's close button. */
  clickClose(): void {
    this.events.onCloseRequested();
  }

  private place(mode: FakeMode): void {
    this.mode = mode;
    this.placements.push(mode);
  }
}

/** A window factory that keeps every fake window it makes. */
export interface FakeWindows {
  readonly create: CreateOutputWindowHandle;
  readonly created: readonly FakeOutputHandle[];
  /** The only window made for the screen; fails the test if there is none or more. */
  only(screenId: string): FakeOutputHandle;
}

export function fakeWindows(): FakeWindows {
  const created: FakeOutputHandle[] = [];
  return {
    create: (screen, events) => {
      const handle = new FakeOutputHandle(screen, events);
      created.push(handle);
      return handle;
    },
    created,
    only: screenId => {
      const matching = created.filter(({screen}) => screen.id === screenId);
      const [handle] = matching;
      if (matching.length !== 1 || handle === undefined) {
        throw new Error(
          `expected one window for ${screenId}, got ${matching.length}`,
        );
      }
      return handle;
    },
  };
}

/** A full screen screen for tests, saved on the given display. */
export function fullScreenScreen(
  overrides: Partial<OutputScreen> = {},
): OutputScreen {
  return {
    id: 'main',
    name: '본 화면',
    method: 'fullscreen',
    display: null,
    onDisconnect: 'window',
    alwaysOnTop: true,
    ...overrides,
  };
}

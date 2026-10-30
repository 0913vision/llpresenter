import type {WebContentsPaintEventParams} from 'electron';
import type {WindowAction} from '@contracts/ipc/api';

/**
 * How the app's windows open. `offscreen` is for UI tests and soak runs: every
 * window draws into memory and never appears, takes focus, goes full screen,
 * stays on top, or shows in the taskbar, so a test never puts a window on the
 * user's screen.
 */
export type WindowMode = 'normal' | 'offscreen';

/** The environment variable that turns on {@link WindowMode} `offscreen`. */
export const TEST_WINDOWS_VARIABLE = 'LLP_TEST_WINDOWS';

const OFFSCREEN_VALUE = 'offscreen';

/** The window options that `offscreen` adds to a window's own options. */
export interface WindowTestOptions {
  readonly show?: false;
  readonly skipTaskbar?: true;
  readonly webPreferences?: {
    readonly offscreen: {readonly useSharedTexture: true};
  };
}

/**
 * Reads the window mode once at launch. A packaged app ignores the variable,
 * so it can't hide the windows of a real service.
 */
export function windowModeFrom(
  env: NodeJS.ProcessEnv,
  isPackaged: boolean,
): WindowMode {
  if (isPackaged) return 'normal';
  return env[TEST_WINDOWS_VARIABLE] === OFFSCREEN_VALUE
    ? 'offscreen'
    : 'normal';
}

export function windowTestOptions(mode: WindowMode): WindowTestOptions {
  switch (mode) {
    case 'normal':
      return {};
    case 'offscreen':
      return {
        show: false,
        skipTaskbar: true,
        webPreferences: {offscreen: {useSharedTexture: true}},
      };
  }
}

type FrameListener = (event: WebContentsPaintEventParams) => void;

interface FrameSource {
  on(event: 'paint', listener: FrameListener): void;
  once(event: 'destroyed', listener: () => void): void;
  removeListener(event: 'paint', listener: FrameListener): void;
}

/** Releases unused test frames immediately, without copying them into bitmaps. */
export function discardTestFrames(
  contents: FrameSource,
  mode: WindowMode,
): void {
  if (mode !== 'offscreen') return;
  // NOTE(0913vision): Bitmap frames retain large native allocations until GC.
  // Shared textures keep rendering active without copying each frame to main.
  const discard: FrameListener = ({texture}) => texture?.release();
  contents.on('paint', discard);
  contents.once('destroyed', () => contents.removeListener('paint', discard));
}

/**
 * Whether the control window's title bar may run the action in this mode.
 * Minimizing or maximizing shows a hidden window, so an offscreen window only
 * closes.
 */
export function allowsWindowAction(
  mode: WindowMode,
  action: WindowAction,
): boolean {
  return mode === 'normal' || action === 'close';
}

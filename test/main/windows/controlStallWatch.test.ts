import {EventEmitter} from 'node:events';
import {afterEach, expect, it, vi} from 'vitest';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {
  CONTROL_HEARTBEAT_MS,
  CONTROL_HEARTBEAT_TIMEOUT_MS,
} from '@main/windows/controlHeartbeat';
import {
  watchControlStall,
  type StallWatchedWindow,
} from '@main/windows/controlStallWatch';
import {
  DISPLAY_SETTLE_MS,
  LATE_DISPLAY_CHANGE_MS,
} from '@main/windows/displayStall';

vi.mock('electron', () => ({screen: {on: vi.fn(), removeListener: vi.fn()}}));

afterEach(() => {
  vi.useRealTimers();
});

/** A control window whose script and picture answer as the test says. */
function controlWindow() {
  const page = new EventEmitter();
  const window = new EventEmitter();
  const answers = {script: true, picture: true};
  const pending = (): Promise<unknown> => new Promise(() => undefined);
  const win: StallWatchedWindow = {
    isDestroyed: () => false,
    isVisible: () => true,
    isMinimized: () => false,
    once: (event, listener) => window.once(event, listener),
    webContents: {
      executeJavaScript: async () => (answers.script ? 0 : await pending()),
      capturePage: async () => (answers.picture ? {} : await pending()),
      on: (event: string, listener: () => void) => page.on(event, listener),
    },
  };
  return {win, page, window, answers};
}

function setup(lastDisplayChange: number | null = null) {
  vi.useFakeTimers({now: 100_000});
  const control = controlWindow();
  const onHang = vi.fn();
  const log = recordingLogger();
  const displays = {last: () => lastDisplayChange, stop: vi.fn()};
  watchControlStall(control.win, {
    windowMode: 'normal',
    onHang,
    log,
    displays,
  });
  control.page.emit('did-finish-load');
  return {...control, onHang, log, displays};
}

/** Enough time for a heartbeat that gets no answer to run out. */
const UNANSWERED_MS = CONTROL_HEARTBEAT_TIMEOUT_MS + CONTROL_HEARTBEAT_MS;

it('stays quiet while the window answers and draws', async () => {
  const {onHang} = setup();
  await vi.advanceTimersByTimeAsync(UNANSWERED_MS * 3);
  expect(onHang).not.toHaveBeenCalled();
});

it('calls a window whose script does not answer hung', async () => {
  const {answers, onHang} = setup();
  answers.script = false;
  await vi.advanceTimersByTimeAsync(UNANSWERED_MS);
  expect(onHang).toHaveBeenCalledExactlyOnceWith(false);
});

it('calls a window that answers but draws nothing hung, after waiting for a late display change', async () => {
  const {answers, onHang} = setup();
  answers.picture = false;
  await vi.advanceTimersByTimeAsync(UNANSWERED_MS);
  expect(onHang).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(LATE_DISPLAY_CHANGE_MS);
  expect(onHang).toHaveBeenCalledExactlyOnceWith(true);
});

it('watches again from the start when the window drew nothing right after the monitors changed', async () => {
  const {answers, onHang, log} = setup(100_000);
  answers.picture = false;
  await vi.advanceTimersByTimeAsync(UNANSWERED_MS + LATE_DISPLAY_CHANGE_MS);
  expect(onHang).not.toHaveBeenCalled();
  expect(log.entries).toContainEqual(
    expect.objectContaining({
      level: 'warn',
      message: 'control window drew nothing while the displays changed',
    }),
  );
  answers.picture = true;
  await vi.advanceTimersByTimeAsync(DISPLAY_SETTLE_MS);
  expect(onHang).not.toHaveBeenCalled();
});

it('does not watch while the page loads, and stops with the window', async () => {
  const {answers, page, window, onHang, displays} = setup();
  page.emit('did-start-loading');
  answers.script = false;
  await vi.advanceTimersByTimeAsync(UNANSWERED_MS * 2);
  expect(onHang).not.toHaveBeenCalled();

  page.emit('did-finish-load');
  window.emit('closed');
  await vi.advanceTimersByTimeAsync(UNANSWERED_MS * 2);
  expect(onHang).not.toHaveBeenCalled();
  expect(displays.stop).toHaveBeenCalledOnce();
});

import {describe, expect, it, vi} from 'vitest';
import {installFakeClock} from '../../../test/fake-clock';
import {recordingLogger} from '../displays/testing';
import {OutputWindow} from './outputWindow';
import type {ShownPlacement} from './placement';
import {COOLDOWN_STEPS_MS, RELAUNCH_DELAY_MS} from './rendererRecovery';
import {ANSWER_LIMIT_MS, FRAME_SILENCE_MS} from './hangWatch';
import {CRASH_LIMIT} from './restartBudget';
import {fakeWindows, fullScreenScreen} from './testing';

const PROJECTOR = {x: 1920, y: 0, width: 1920, height: 1080};
const FULL_SCREEN: ShownPlacement = {
  kind: 'fullscreen',
  bounds: PROJECTOR,
  alwaysOnTop: true,
};
const FALLBACK: ShownPlacement = {
  kind: 'window',
  bounds: {x: 480, y: 250, width: 960, height: 540},
  reason: 'monitorMissing',
};

function setUp() {
  const windows = fakeWindows();
  const log = recordingLogger();
  const onCloseRequested = vi.fn();
  const output = new OutputWindow({
    screen: fullScreenScreen(),
    createHandle: windows.create,
    onCloseRequested,
    log,
  });
  return {output, windows, log, onCloseRequested};
}

describe('OutputWindow', () => {
  it('recenters a lost-monitor fallback when the work area settles again', () => {
    const {output, windows} = setUp();
    output.update(FULL_SCREEN);
    output.update({
      ...FALLBACK,
      bounds: {x: 1240, y: 450, width: 960, height: 540},
    });
    const handle = windows.only('main');
    const final = {
      ...FALLBACK,
      bounds: {x: 1271, y: 450, width: 960, height: 540},
    };
    output.update(final);
    expect(handle.mode).toEqual({kind: 'window', bounds: final.bounds});
    output.update({...final});
    expect(handle.placements).toHaveLength(3);
    expect(handle.reloads).toBe(0);
    output.dispose();
  });
  it('updates always on top in window and capture modes without resetting an operator-moved window', () => {
    const {output, windows} = setUp();
    output.update({...FALLBACK, reason: 'method'});
    output.update({...FALLBACK, reason: 'method', alwaysOnTop: true});
    expect(windows.only('main').mode).toEqual({
      kind: 'window',
      bounds: null,
      alwaysOnTop: true,
    });
    const capture = {kind: 'capture', bounds: PROJECTOR} as const;
    output.update(capture);
    output.update({...capture, alwaysOnTop: true});
    expect(windows.only('main').mode).toEqual({...capture, alwaysOnTop: true});
    output.dispose();
  });

  it('reuses one window across full screen, capture resolution changes, normal window and hide', () => {
    const {output, windows} = setUp();
    output.update(FULL_SCREEN);
    const capture = {
      kind: 'capture',
      bounds: {x: 0, y: 0, width: 1920, height: 1080},
    } as const;
    output.update(capture);
    output.update({...capture, bounds: {...capture.bounds}});
    const handle = windows.only('main');
    expect(handle.placements).toHaveLength(2);
    output.update({
      ...capture,
      bounds: {...capture.bounds, width: 1280, height: 720},
    });
    expect(handle.mode).toMatchObject({
      kind: 'capture',
      bounds: {width: 1280, height: 720},
    });
    output.update(FALLBACK);
    expect(handle.mode).toEqual({kind: 'window', bounds: FALLBACK.bounds});
    output.update(null);
    output.update(capture);
    expect(handle.mode).toEqual(capture);
    expect(windows.created).toHaveLength(1);
    expect(handle.reloads).toBe(0);
    output.dispose();
    expect(handle.destroyed).toBe(true);
  });

  it('reports where a shown capture window is now, and nothing in other modes', () => {
    const {output, windows} = setUp();
    expect(output.captureArea()).toBeNull();
    output.update(FULL_SCREEN);
    expect(output.captureArea()).toBeNull();
    output.update({kind: 'capture', bounds: PROJECTOR});
    const handle = windows.only('main');
    const moved = {x: 100, y: 50, width: 1920, height: 1080};
    handle.mode = {kind: 'capture', bounds: moved};
    expect(output.captureArea()).toEqual(moved);
    output.update(FALLBACK);
    expect(output.captureArea()).toBeNull();
    output.update({kind: 'capture', bounds: PROJECTOR});
    output.update(null);
    expect(output.captureArea()).toBeNull();
    output.update({kind: 'capture', bounds: PROJECTOR});
    output.dispose();
    expect(output.captureArea()).toBeNull();
  });

  it('creates no window until the output first turns on', () => {
    const {output, windows} = setUp();
    output.update(null);
    expect(windows.created).toHaveLength(0);
    output.update(FULL_SCREEN);
    expect(windows.only('main').mode).toEqual(FULL_SCREEN);
  });

  it('keeps one window across hides and shows it again in place', () => {
    const {output, windows} = setUp();
    output.update(FULL_SCREEN);
    output.update(null);
    const handle = windows.only('main');
    expect(handle.mode).toEqual({kind: 'hidden'});
    output.update(FULL_SCREEN);
    expect(windows.created).toHaveLength(1);
    expect(handle.mode.kind).toBe('fullscreen');
  });

  it('leaves a visible window alone when the placement is the same', () => {
    const {output, windows} = setUp();
    output.update(FULL_SCREEN);
    output.update({...FULL_SCREEN, bounds: {...PROJECTOR}});
    expect(windows.only('main').placements).toHaveLength(1);
  });

  it('fits the window again when its monitor changes resolution', () => {
    const {output, windows} = setUp();
    output.update(FULL_SCREEN);
    const larger = {...PROJECTOR, width: 2560, height: 1440};
    output.update({...FULL_SCREEN, bounds: larger});
    expect(windows.only('main').mode).toMatchObject({bounds: larger});
  });

  it('moves the same window between full screen and the fallback window', () => {
    const {output, windows} = setUp();
    output.update(FULL_SCREEN);
    output.update(FALLBACK);
    output.update(FULL_SCREEN);
    const handle = windows.only('main');
    expect(handle.placements.map(({kind}) => kind)).toEqual([
      'fullscreen',
      'window',
      'fullscreen',
    ]);
    expect(handle.reloads).toBe(0);
  });

  it('raises the window for 창 보기 only while it shows as a normal window', () => {
    const {output, windows} = setUp();
    output.bringToFront();
    output.update(FULL_SCREEN);
    output.bringToFront();
    const handle = windows.only('main');
    expect(handle.raises).toBe(0);

    output.update(FALLBACK);
    output.bringToFront();
    expect(handle.raises).toBe(1);

    output.update(null);
    output.bringToFront();
    output.update(FALLBACK);
    output.dispose();
    output.bringToFront();
    expect(handle.raises).toBe(1);
  });

  it('keeps where the operator dragged a window when it shows again', () => {
    const {output, windows} = setUp();
    output.update(FALLBACK);
    output.update(null);
    output.update(FALLBACK);
    expect(windows.only('main').placements).toEqual([
      {kind: 'window', bounds: FALLBACK.bounds},
      {kind: 'window', bounds: null},
    ]);
  });

  it('reports a click on the close button', () => {
    const {output, windows, onCloseRequested} = setUp();
    output.update(FALLBACK);
    windows.only('main').clickClose();
    expect(onCloseRequested).toHaveBeenCalledTimes(1);
  });

  it('reloads the page soon after its renderer crashes', async () => {
    const clock = installFakeClock();
    const {output, windows, log} = setUp();
    output.update(FULL_SCREEN);
    const handle = windows.only('main');
    handle.crash('oom');
    await clock.advance(RELAUNCH_DELAY_MS - 1);
    expect(handle.reloads).toBe(0);
    await clock.advance(1);
    expect(handle.reloads).toBe(1);
    expect(handle.mode.kind).toBe('fullscreen');
    expect(log.messages('error')).toEqual(['output window process gone']);
  });

  it('reloads again when the page fails to load after a crash', async () => {
    const clock = installFakeClock();
    const {output, windows, log} = setUp();
    output.update(FULL_SCREEN);
    const handle = windows.only('main');
    handle.failNextReload = true;
    handle.crash();
    await clock.advance(RELAUNCH_DELAY_MS);
    expect(log.messages('error')).toContain('output window page did not load');
    await clock.advance(RELAUNCH_DELAY_MS);
    expect(handle.reloads).toBe(2);
    output.frameReported();
    expect(output.rendererState).toBe('running');
  });

  it('holds the empty picture after repeated crashes and tries again after the cool-down', async () => {
    const clock = installFakeClock();
    const {output, windows} = setUp();
    output.update(FULL_SCREEN);
    const handle = windows.only('main');
    for (let crash = 0; crash < CRASH_LIMIT; crash += 1) {
      handle.crash();
      await clock.advance(RELAUNCH_DELAY_MS);
    }
    expect(handle.reloads).toBe(CRASH_LIMIT - 1);
    expect(output.rendererState).toBe('limited');
    expect(handle.mode.kind).toBe('fullscreen');
    await clock.advance(COOLDOWN_STEPS_MS[0] ?? 0);
    expect(handle.reloads).toBe(CRASH_LIMIT);
  });

  it('stops the attempts while the output is off and tries at once when it turns on', async () => {
    const clock = installFakeClock();
    const {output, windows} = setUp();
    output.update(FULL_SCREEN);
    const handle = windows.only('main');
    for (let crash = 0; crash < CRASH_LIMIT; crash += 1) {
      handle.crash();
      await clock.advance(RELAUNCH_DELAY_MS);
    }
    output.update(null);
    await clock.advance(COOLDOWN_STEPS_MS.at(-1) ?? 0);
    expect(handle.reloads).toBe(CRASH_LIMIT - 1);
    output.update(FULL_SCREEN);
    expect(handle.reloads).toBe(CRASH_LIMIT);
  });

  it('destroys the window and its pending restart on dispose', async () => {
    const clock = installFakeClock();
    const {output, windows} = setUp();
    output.update(FULL_SCREEN);
    const handle = windows.only('main');
    handle.crash();
    output.dispose();
    await clock.runAll();
    expect(handle.destroyed).toBe(true);
    expect(handle.reloads).toBe(0);
    output.update(FULL_SCREEN);
    expect(windows.created).toHaveLength(1);
  });

  it('crashes the renderer of a visible output that stops reporting and answering', async () => {
    const clock = installFakeClock();
    const {output, windows, log} = setUp();
    output.update(FULL_SCREEN);
    const handle = windows.only('main');
    handle.answerAfterMs = null;
    output.frameReported();
    await clock.advance(FRAME_SILENCE_MS - 1);
    output.frameReported();
    await clock.advance(FRAME_SILENCE_MS - 1);
    expect(handle.pings).toBe(0);
    await clock.advance(1 + ANSWER_LIMIT_MS - 1);
    expect(handle.pings).toBe(1);
    expect(handle.forcedCrashes).toBe(0);
    await clock.advance(1);
    expect(handle.forcedCrashes).toBe(1);
    expect(log.messages('error')).toContain(
      'output window stopped drawing and answering; restarting its renderer',
    );
  });

  it('never crashes a slow renderer that answers within the limit', async () => {
    const clock = installFakeClock();
    const {output, windows} = setUp();
    output.update(FULL_SCREEN);
    const handle = windows.only('main');
    handle.answerAfterMs = ANSWER_LIMIT_MS - 1;
    output.frameReported();
    await clock.advance(10 * (FRAME_SILENCE_MS + ANSWER_LIMIT_MS));
    expect(handle.pings).toBeGreaterThan(1);
    expect(handle.forcedCrashes).toBe(0);
  });

  it('logs a page that answers but reports no frames instead of crashing it', async () => {
    const clock = installFakeClock();
    const {output, windows, log} = setUp();
    output.update(FULL_SCREEN);
    const handle = windows.only('main');
    output.frameReported();
    await clock.advance(10 * (FRAME_SILENCE_MS + ANSWER_LIMIT_MS));
    expect(handle.forcedCrashes).toBe(0);
    expect(log.messages('warn')).toEqual([
      'output window answers but reports no frames',
    ]);
  });

  it('crashes a hung renderer again when the first forced crash does not end it', async () => {
    const clock = installFakeClock();
    const {output, windows} = setUp();
    output.update(FULL_SCREEN);
    const handle = windows.only('main');
    handle.answerAfterMs = null;
    output.frameReported();
    await clock.advance(FRAME_SILENCE_MS + ANSWER_LIMIT_MS);
    expect(handle.forcedCrashes).toBe(1);
    await clock.advance(FRAME_SILENCE_MS + ANSWER_LIMIT_MS);
    expect(handle.forcedCrashes).toBe(2);
    handle.crash();
    await clock.advance(2 * (FRAME_SILENCE_MS + ANSWER_LIMIT_MS));
    expect(handle.forcedCrashes).toBe(2);
  });

  it('watches a page that drew before again when its output turns on again', async () => {
    const clock = installFakeClock();
    const {output, windows} = setUp();
    output.update(FULL_SCREEN);
    const handle = windows.only('main');
    handle.answerAfterMs = null;
    output.frameReported();
    output.update(null);
    await clock.advance(2 * (FRAME_SILENCE_MS + ANSWER_LIMIT_MS));
    expect(handle.pings).toBe(0);
    output.update(FULL_SCREEN);
    await clock.advance(FRAME_SILENCE_MS + ANSWER_LIMIT_MS);
    expect(handle.forcedCrashes).toBe(1);
  });

  it('does not watch a page that has not drawn since it loaded', async () => {
    const clock = installFakeClock();
    const {output, windows} = setUp();
    output.update(FULL_SCREEN);
    const handle = windows.only('main');
    handle.answerAfterMs = null;
    await clock.advance(2 * (FRAME_SILENCE_MS + ANSWER_LIMIT_MS));
    expect(handle.pings).toBe(0);

    output.frameReported();
    handle.crash();
    output.update(null);
    output.update(FULL_SCREEN);
    await clock.advance(RELAUNCH_DELAY_MS);
    expect(handle.reloads).toBe(1);
    await clock.advance(FRAME_SILENCE_MS + ANSWER_LIMIT_MS);
    expect(handle.forcedCrashes).toBe(0);
  });

  it('keeps one ping in flight to a hung page through retries and hide and show', async () => {
    const clock = installFakeClock();
    const {output, windows} = setUp();
    output.update(FULL_SCREEN);
    const handle = windows.only('main');
    handle.answerAfterMs = null;
    output.frameReported();
    await clock.advance(3 * (FRAME_SILENCE_MS + ANSWER_LIMIT_MS));
    output.update(null);
    output.update(FULL_SCREEN);
    await clock.advance(2 * (FRAME_SILENCE_MS + ANSWER_LIMIT_MS));
    expect(handle.forcedCrashes).toBe(5);
    expect(handle.pings).toBe(1);

    handle.crash();
    await clock.advance(RELAUNCH_DELAY_MS);
    output.frameReported();
    await clock.advance(FRAME_SILENCE_MS);
    expect(handle.pings).toBe(2);
  });

  it('does not watch a hidden output or one that is restarting', async () => {
    const clock = installFakeClock();
    const {output, windows} = setUp();
    output.update(FULL_SCREEN);
    const handle = windows.only('main');
    handle.answerAfterMs = null;
    output.frameReported();
    output.update(null);
    await clock.advance(2 * (FRAME_SILENCE_MS + ANSWER_LIMIT_MS));
    expect(handle.forcedCrashes).toBe(0);

    output.update(FULL_SCREEN);
    output.frameReported();
    handle.crash();
    await clock.advance(2 * (FRAME_SILENCE_MS + ANSWER_LIMIT_MS));
    expect(handle.forcedCrashes).toBe(0);
  });
});

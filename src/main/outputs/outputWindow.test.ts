import {describe, expect, it, vi} from 'vitest';
import {installFakeClock} from '../../../test/fake-clock';
import {recordingLogger} from '../displays/testing';
import {OutputWindow} from './outputWindow';
import type {ShownPlacement} from './placement';
import {COOLDOWN_STEPS_MS, RELAUNCH_DELAY_MS} from './rendererRecovery';
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
    output.pageDrawn();
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
});

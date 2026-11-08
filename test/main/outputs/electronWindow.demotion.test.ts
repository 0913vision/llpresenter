import {
  WINDOW_BOUNDS,
  mockControl,
  openOutput,
  lastWindow,
} from '@fixtures/main/outputs/electronWindowFixtures';
import {expect, it} from 'vitest';
import {installMockClock} from '@fixtures/mockClock';
import {BOUNDS_RECHECK_MS} from '@main/outputs/windowPlacement';

it('shows an initially hidden fallback behind control without activation', async () => {
  const clock = installMockClock();
  const control = mockControl();
  const output = openOutput('normal', control);
  const win = lastWindow();
  output.prepareForMonitorRemoval();
  output.showWindowed(WINDOW_BOUNDS);
  expect(control.moveAbove.mock.invocationCallOrder.at(-1)).toBeGreaterThan(
    win.moveTop.mock.invocationCallOrder.at(-1) ?? 0,
  );
  expect(win.isAlwaysOnTop()).toBe(false);
  expect(control.focus).not.toHaveBeenCalled();
  expect(win.focus).not.toHaveBeenCalled();
  await clock.advance(BOUNDS_RECHECK_MS);
  control.moveAbove.mockClear();
  output.bringToFront();
  win.emit('move');
  await clock.advance(BOUNDS_RECHECK_MS);
  expect(control.moveAbove).not.toHaveBeenCalled();
});

it.each([false, true])(
  'ends disconnect demotion before capture changes with top=%s',
  async alwaysOnTop => {
    const clock = installMockClock();
    const control = mockControl();
    const output = openOutput('normal', control);
    const win = lastWindow();
    output.showWindowed(WINDOW_BOUNDS);
    output.prepareForMonitorRemoval();
    output.showWindowed(WINDOW_BOUNDS);
    control.moveAbove.mockClear();
    for (const width of [1280, 1920]) {
      const bounds = {...WINDOW_BOUNDS, width};
      output.showCapture(bounds, alwaysOnTop);
      await clock.advance(BOUNDS_RECHECK_MS);
      expect(win.setContentBounds).toHaveBeenCalledWith(bounds);
      expect(control.moveAbove).not.toHaveBeenCalled();
    }
    expect(win.isAlwaysOnTop()).toBe(alwaysOnTop);
    expect(control.focus).not.toHaveBeenCalled();
    expect(win.focus).not.toHaveBeenCalled();
  },
);

it.each([false, true])(
  'ends disconnect demotion when the top option becomes %s during a bounds check',
  async alwaysOnTop => {
    const clock = installMockClock();
    const control = mockControl();
    const output = openOutput('normal', control);
    const win = lastWindow();
    output.prepareForMonitorRemoval();
    output.showWindowed(WINDOW_BOUNDS);
    control.moveAbove.mockClear();
    output.setAlwaysOnTop(alwaysOnTop);
    win.emit('move');
    await clock.advance(BOUNDS_RECHECK_MS);
    expect(control.moveAbove).not.toHaveBeenCalled();
    expect(win.isAlwaysOnTop()).toBe(alwaysOnTop);
    expect(control.focus).not.toHaveBeenCalled();
  },
);

it('does not demote a windowed output requested with always on top', async () => {
  const clock = installMockClock();
  const control = mockControl();
  const output = openOutput('normal', control);
  output.prepareForMonitorRemoval();
  output.showWindowed(WINDOW_BOUNDS);
  control.moveAbove.mockClear();
  output.showWindowed(WINDOW_BOUNDS, true);
  await clock.advance(BOUNDS_RECHECK_MS);
  expect(control.moveAbove).not.toHaveBeenCalled();
  expect(lastWindow().isAlwaysOnTop()).toBe(true);
});

it.each([false, true])(
  'finishes fallback demotion after bounds verification with restore=%s',
  async restored => {
    const clock = installMockClock();
    const control = mockControl();
    const output = openOutput('normal', control);
    const win = lastWindow();
    let bounds = WINDOW_BOUNDS;
    win.getBounds.mockImplementation(() => bounds);
    win.setBounds.mockImplementation(next => {
      bounds = next;
    });
    output.prepareForMonitorRemoval();
    output.showWindowed(WINDOW_BOUNDS);
    expect(control.moveAbove).toHaveBeenCalledTimes(2);
    if (restored) bounds = {...bounds, x: bounds.x + 500};
    await clock.advance(BOUNDS_RECHECK_MS);
    expect(control.moveAbove).toHaveBeenCalledTimes(restored ? 3 : 2);
    control.moveAbove.mockClear();
    const workAreaChange = {...WINDOW_BOUNDS, x: 200};
    output.showWindowed(workAreaChange);
    bounds = {...bounds, x: bounds.x + 500};
    win.emit('move');
    await clock.advance(0);
    expect(bounds).toEqual(workAreaChange);
    expect(control.moveAbove).not.toHaveBeenCalled();
    expect(control.focus).not.toHaveBeenCalled();
  },
);

it('finishes demotion immediately when fallback needs no bounds check', () => {
  const control = mockControl();
  const output = openOutput('normal', control);
  output.prepareForMonitorRemoval();
  output.showWindowed(null);
  control.moveAbove.mockClear();
  output.showWindowed(null);
  expect(control.moveAbove).not.toHaveBeenCalled();
});

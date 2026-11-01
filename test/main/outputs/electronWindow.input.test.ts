import {
  WINDOW_BOUNDS,
  mockLog,
  mockControl,
  openOutput,
  lastWindow,
} from '@fixtures/main/outputs/electronWindowFixtures';
import {expect, it, vi} from 'vitest';

it('forwards clear and navigation after an output click without focusing or raising control', async () => {
  const control = mockControl();
  const output = openOutput('normal', control);
  const win = lastWindow();
  output.showWindowed(WINDOW_BOUNDS);
  output.bringToFront();
  const event = {preventDefault: vi.fn()};
  const input = {
    modifiers: [],
    isAutoRepeat: false,
    isComposing: false,
    location: 0,
    control: false,
    alt: false,
    meta: false,
    shift: false,
  };
  for (const code of ['F2', 'ArrowRight']) {
    win.webContents.emit('before-input-event', event, {
      ...input,
      type: 'keyDown',
      key: code,
      code,
    });
    win.webContents.emit('before-input-event', event, {
      ...input,
      type: 'keyUp',
      key: code,
      code,
    });
  }
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  const calls = control.webContents.executeJavaScript.mock.calls;
  expect(calls.map(([script]) => script)).toEqual([
    expect.stringContaining('"keydown",{"key":"F2","code":"F2"'),
    expect.stringContaining('"keyup",{"key":"F2","code":"F2"'),
    expect.stringContaining(
      '"keydown",{"key":"ArrowRight","code":"ArrowRight"',
    ),
    expect.stringContaining('"keyup",{"key":"ArrowRight","code":"ArrowRight"'),
  ]);
  expect(event.preventDefault).toHaveBeenCalledTimes(4);
  expect(control.focus).not.toHaveBeenCalled();
  expect(control.moveAbove).not.toHaveBeenCalled();
  output.destroy();
  expect(win.webContents.listenerCount('before-input-event')).toBe(0);
});

it('bounds queued keys and safely releases a destroyed control while forwarding is pending', async () => {
  const control = mockControl();
  const log = mockLog();
  let resolve = (): void => {};
  control.webContents.executeJavaScript.mockImplementationOnce(
    () =>
      new Promise<void>(done => {
        resolve = done;
      }),
  );
  const output = openOutput('offscreen', control, log);
  const win = lastWindow();
  const event = {preventDefault: vi.fn()};
  const input = {
    modifiers: [],
    type: 'keyDown',
    key: 'F2',
    code: 'F2',
    isAutoRepeat: false,
    isComposing: false,
    location: 0,
    control: false,
    alt: false,
    meta: false,
    shift: false,
  };
  win.webContents.emit('before-input-event', event, input);
  for (let i = 0; i < 100; i += 1) {
    win.webContents.emit('before-input-event', event, input);
  }
  expect(log.error).toHaveBeenCalledOnce();
  expect(control.webContents.executeJavaScript).toHaveBeenCalledOnce();
  control.isDestroyed.mockReturnValue(true);
  Object.defineProperty(control, 'webContents', {
    get: () => {
      throw new Error('Destroyed control getter');
    },
  });
  expect(() =>
    win.webContents.emit('before-input-event', event, input),
  ).not.toThrow();
  output.destroy();
  resolve();
  await Promise.resolve();
  expect(win.webContents.listenerCount('before-input-event')).toBe(0);
});

import {EventEmitter} from 'node:events';
import {describe, expect, it, vi} from 'vitest';
import {forwardOutputKeys} from '@main/outputs/outputKeys';

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

function mockControl() {
  return {
    isDestroyed: vi.fn(() => false),
    webContents: {
      isDestroyed: vi.fn(() => false),
      executeJavaScript: vi.fn(() => Promise.resolve()),
    },
  };
}

function mockLog() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: () => Promise.resolve(),
  };
}

async function settle(): Promise<void> {
  for (let tick = 0; tick < 4; tick += 1) await Promise.resolve();
}

describe('forwardOutputKeys', () => {
  it('sends each key down and up to the control page in order and keeps it from the output page', async () => {
    const source = new EventEmitter();
    const control = mockControl();
    const stop = forwardOutputKeys(source, control, mockLog());
    const event = {preventDefault: vi.fn()};

    for (const code of ['F2', 'ArrowRight']) {
      source.emit('before-input-event', event, {
        ...input,
        type: 'keyDown',
        key: code,
        code,
      });
      source.emit('before-input-event', event, {
        ...input,
        type: 'keyUp',
        key: code,
        code,
      });
    }
    await settle();

    expect(
      control.webContents.executeJavaScript.mock.calls.map(
        ([script]: unknown[]) => script,
      ),
    ).toEqual([
      expect.stringContaining('"keydown",{"key":"F2","code":"F2"'),
      expect.stringContaining('"keyup",{"key":"F2","code":"F2"'),
      expect.stringContaining(
        '"keydown",{"key":"ArrowRight","code":"ArrowRight"',
      ),
      expect.stringContaining(
        '"keyup",{"key":"ArrowRight","code":"ArrowRight"',
      ),
    ]);
    expect(event.preventDefault).toHaveBeenCalledTimes(4);
    stop();
    expect(source.listenerCount('before-input-event')).toBe(0);
  });

  it('bounds the queued keys, logs once, and ignores keys once the control is gone', async () => {
    const source = new EventEmitter();
    const control = mockControl();
    const log = mockLog();
    let resolve = (): void => {};
    control.webContents.executeJavaScript.mockImplementationOnce(
      () =>
        new Promise<void>(done => {
          resolve = done;
        }),
    );
    const stop = forwardOutputKeys(source, control, log);
    const event = {preventDefault: vi.fn()};
    const key = {...input, type: 'keyDown', key: 'F2', code: 'F2'};

    for (let i = 0; i < 101; i += 1) {
      source.emit('before-input-event', event, key);
    }
    expect(log.error).toHaveBeenCalledOnce();
    expect(control.webContents.executeJavaScript).toHaveBeenCalledOnce();
    control.isDestroyed.mockReturnValue(true);
    expect(() => source.emit('before-input-event', event, key)).not.toThrow();
    stop();
    resolve();
    await settle();
    expect(control.webContents.executeJavaScript).toHaveBeenCalledOnce();
  });
});

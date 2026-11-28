import {EventEmitter} from 'node:events';
import {describe, expect, it, vi} from 'vitest';
import type {Logger} from '@main/base/log';
import {
  CONSOLE_ERRORS_PER_MINUTE,
  logConsoleErrors,
} from '@main/base/renderers/consoleErrors';

function logger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: () => Promise.resolve(),
  };
}

function message(
  text: string,
  level: 'info' | 'warning' | 'error' | 'debug' = 'error',
) {
  return {level, message: text, sourceId: 'app://index.js', lineNumber: 12};
}

describe('logConsoleErrors', () => {
  it('writes the console errors of the window, not warnings, uncaught errors or the browser resize loop notice', () => {
    const contents = new EventEmitter();
    const log = logger();
    logConsoleErrors(contents, {window: 'control window', log});

    contents.emit('console-message', message('Repeat callback failed: x'));
    contents.emit('console-message', message('note', 'warning'));
    contents.emit('console-message', message('Uncaught Error: shown'));
    contents.emit(
      'console-message',
      message('ResizeObserver loop completed with undelivered notifications.'),
    );

    expect(log.error).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalledWith(
      'console error in the control window',
      {
        message: 'Repeat callback failed: x',
        source: 'app://index.js:12',
      },
    );
  });

  it('writes at most the minute limit, then one line with how many it dropped', () => {
    const contents = new EventEmitter();
    const log = logger();
    let now = 0;
    logConsoleErrors(contents, {
      window: 'control window',
      log,
      now: () => now,
    });

    for (let index = 0; index < CONSOLE_ERRORS_PER_MINUTE + 5; index += 1) {
      contents.emit('console-message', message(`failed ${index}`));
    }
    now = 60_000;
    contents.emit('console-message', message('next minute'));

    expect(log.error).toHaveBeenCalledTimes(CONSOLE_ERRORS_PER_MINUTE + 1);
    expect(log.warn).toHaveBeenCalledWith(
      'dropped console errors of the control window',
      {count: 5},
    );
  });

  it('stops when asked', () => {
    const contents = new EventEmitter();
    const log = logger();
    const stop = logConsoleErrors(contents, {
      window: 'settings window',
      log,
    });

    stop();
    contents.emit('console-message', message('after'));

    expect(log.error).not.toHaveBeenCalled();
  });
});

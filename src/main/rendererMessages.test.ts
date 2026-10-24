import {describe, expect, it} from 'vitest';
import {recordingLogger} from './displays/testing';
import {FrameRateTracker} from './outputs/frameRates';
import {
  WINDOW_LOG_LINES_PER_SECOND,
  WindowLogLimiter,
  handleFrameRate,
  handleLogWrite,
} from './rendererMessages';

const WINDOW = 7;
const OTHER_WINDOW = 8;

function logWriter(log: ReturnType<typeof recordingLogger>) {
  return handleLogWrite(log, new WindowLogLimiter(log));
}

describe('handleLogWrite', () => {
  it("writes a window's line at its level with its detail", () => {
    const log = recordingLogger();
    logWriter(log)(
      {
        level: 'error',
        message: 'could not draw the lyrics layer',
        detail: 'Error: layout failed',
      },
      WINDOW,
    );
    expect(log.entries).toEqual([
      {
        level: 'error',
        message: 'window: could not draw the lyrics layer',
        detail: 'Error: layout failed',
      },
    ]);
  });

  it.each([
    null,
    'text',
    {level: 'fatal', message: 'x'},
    {level: 'info', message: ''},
    {level: 'info', message: 'x'.repeat(501)},
  ])('drops a malformed entry: %j', value => {
    const log = recordingLogger();
    logWriter(log)(value, WINDOW);
    expect(log.messages('warn')).toEqual([
      'dropped a malformed log entry from a window',
    ]);
    expect(log.messages('error')).toEqual([]);
  });
});

describe('handleFrameRate', () => {
  it('passes a valid report to the tracker', () => {
    const log = recordingLogger();
    const tracker = new FrameRateTracker(() => true, log);
    handleFrameRate(tracker, log)({screenId: 'main', fps: 59.9}, WINDOW);
    expect(tracker.current('main')).toEqual({fps: 59.9, status: 'normal'});
  });

  it.each([
    {screenId: 'main', fps: Number.NaN},
    {screenId: '', fps: 60},
    {fps: 60},
  ])('drops a malformed report: %j', value => {
    const log = recordingLogger();
    const tracker = new FrameRateTracker(() => true, log);
    handleFrameRate(tracker, log)(value, WINDOW);
    expect(tracker.current('main')).toBeNull();
    expect(log.messages('warn')).toEqual([
      'dropped a malformed frame rate report',
    ]);
  });
});

describe('WindowLogLimiter', () => {
  function setUp() {
    let time = 0;
    const log = recordingLogger();
    const limiter = new WindowLogLimiter(log, () => time);
    const write = logWriter(log);
    const flood = (from: number, lines: number): void => {
      for (let line = 0; line < lines; line += 1) {
        write({level: 'warn', message: `line ${line}`}, from);
      }
    };
    return {log, limiter, flood, later: (ms: number) => (time += ms)};
  }

  it('lets a window write its share each second and drops the rest', () => {
    const {log, flood} = setUp();
    flood(WINDOW, WINDOW_LOG_LINES_PER_SECOND + 30);
    expect(log.entries).toHaveLength(WINDOW_LOG_LINES_PER_SECOND);
  });

  it('logs how many lines it dropped when the window writes again', () => {
    let time = 0;
    const log = recordingLogger();
    const write = handleLogWrite(log, new WindowLogLimiter(log, () => time));
    for (let line = 0; line < WINDOW_LOG_LINES_PER_SECOND + 30; line += 1) {
      write({level: 'info', message: `line ${line}`}, WINDOW);
    }
    time += 1000;
    write({level: 'info', message: 'calm again'}, WINDOW);
    expect(log.entries.at(-2)).toEqual({
      level: 'warn',
      message: 'dropped log lines from a window that logged too fast',
      detail: {window: WINDOW, dropped: 30},
    });
    expect(log.entries.at(-1)?.message).toBe('window: calm again');
  });

  it('keeps one flooding window from silencing another', () => {
    const {log, flood} = setUp();
    flood(WINDOW, WINDOW_LOG_LINES_PER_SECOND * 3);
    flood(OTHER_WINDOW, 1);
    expect(log.entries.at(-1)?.message).toBe('window: line 0');
    expect(log.entries).toHaveLength(WINDOW_LOG_LINES_PER_SECOND + 1);
  });

  it('counts malformed entries against the window too', () => {
    const log = recordingLogger();
    const write = logWriter(log);
    for (let line = 0; line < WINDOW_LOG_LINES_PER_SECOND * 2; line += 1) {
      write('not an entry', WINDOW);
    }
    expect(log.entries).toHaveLength(WINDOW_LOG_LINES_PER_SECOND);
  });
});

import {beforeEach, describe, expect, it, vi} from 'vitest';
import {outputEndpoints} from '@contracts/ipc/output';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {
  registerWindowLog,
  WINDOW_LOG_LINES_PER_SECOND,
  WindowLogLimiter,
} from '@main/base/windowLog';

const ipc = await vi.hoisted(async () =>
  (await import('@fixtures/main/base/mockIpcMain')).mockIpcMain(),
);
vi.mock('electron', () => ({ipcMain: ipc.ipcMain}));

const WINDOW = 7;
const OTHER_WINDOW = 8;

describe('registerWindowLog', () => {
  it("writes a window's line at its level with its detail", () => {
    const log = recordingLogger();
    const stop = registerWindowLog(log);
    ipc.send(outputEndpoints.log, {
      level: 'error',
      message: 'could not draw the lyrics layer',
      detail: 'Error: layout failed',
    });
    expect(log.entries).toEqual([
      {
        level: 'error',
        message: 'window: could not draw the lyrics layer',
        detail: 'Error: layout failed',
      },
    ]);
    stop();
    expect(ipc.has(outputEndpoints.log.channel)).toBe(false);
  });

  it.each([
    null,
    'text',
    {level: 'fatal', message: 'x'},
    {level: 'info', message: ''},
    {level: 'info', message: 'x'.repeat(501)},
  ])('drops a malformed entry: %j', value => {
    const log = recordingLogger();
    const stop = registerWindowLog(log);
    ipc.send(outputEndpoints.log, value);
    expect(log.messages('warn')).toEqual([
      'dropped a malformed log:write message',
    ]);
    expect(log.messages('error')).toEqual([]);
    stop();
  });

  it('holds a window back that writes too fast, and no other', () => {
    const log = recordingLogger();
    const stop = registerWindowLog(log);
    const write = (id: number, lines: number): void => {
      for (let line = 0; line < lines; line += 1) {
        ipc.send(
          outputEndpoints.log,
          {level: 'warn', message: `line ${line}`},
          {id},
        );
      }
    };
    write(WINDOW, WINDOW_LOG_LINES_PER_SECOND * 3);
    expect(log.entries).toHaveLength(WINDOW_LOG_LINES_PER_SECOND);
    write(OTHER_WINDOW, 1);
    expect(log.entries.at(-1)?.message).toBe('window: line 0');
    stop();
  });
});

describe('WindowLogLimiter', () => {
  let time = 0;
  beforeEach(() => {
    time = 0;
  });

  it('lets a window write its share each second and drops the rest', () => {
    const limiter = new WindowLogLimiter(recordingLogger(), () => time);
    const admitted = () =>
      Array.from({length: WINDOW_LOG_LINES_PER_SECOND + 30}, () =>
        limiter.admit(WINDOW),
      ).filter(Boolean).length;
    expect(admitted()).toBe(WINDOW_LOG_LINES_PER_SECOND);
    time += 1000;
    expect(admitted()).toBe(WINDOW_LOG_LINES_PER_SECOND);
  });

  it('logs how many lines it dropped when the window writes again', () => {
    const log = recordingLogger();
    const limiter = new WindowLogLimiter(log, () => time);
    for (let line = 0; line < WINDOW_LOG_LINES_PER_SECOND + 30; line += 1) {
      limiter.admit(WINDOW);
    }
    time += 1000;
    limiter.admit(WINDOW);
    expect(log.entries).toEqual([
      {
        level: 'warn',
        message: 'dropped log lines from a window that logged too fast',
        detail: {window: WINDOW, dropped: 30},
      },
    ]);
  });
});

import {describe, expect, it} from 'vitest';
import {
  DIAGNOSTICS_ERROR_LINES,
  DIAGNOSTICS_LINE_LIMIT,
  errorLinesOf,
  formatDiagnostics,
  withoutFolders,
} from '@core/app/diagnostics';

const INFO = {
  appVersion: '1.2.3',
  windowsVersion: '10.0.19045',
  graphics: ['Invented GPU'],
  monitors: [
    {number: 1, width: 1920, height: 1080, scaleFactor: 1.25},
    {number: 2, width: 1280, height: 720, scaleFactor: 1},
  ],
  screens: [
    {
      name: '청중 화면',
      kind: 'audience',
      method: 'fullscreen',
      monitorNumber: 2,
    },
    {name: '방송 화면', kind: 'broadcast', method: 'capture'},
  ],
  errors: ['2026-11-03T10:00:00.000Z ERROR could not play audio'],
};

describe('formatDiagnostics', () => {
  it('lists the versions, the graphics, the monitors, the screens, and the errors', () => {
    expect(formatDiagnostics(INFO)).toBe(
      [
        'LoveLight 1.2.3',
        'Windows 10.0.19045',
        'Graphics: Invented GPU',
        'Monitors:',
        '  1: 1920x1080 at 125%',
        '  2: 1280x720 at 100%',
        'Screens:',
        '  청중 화면 (audience, fullscreen) on monitor 2',
        '  방송 화면 (broadcast, capture)',
        'Last errors (1):',
        '  2026-11-03T10:00:00.000Z ERROR could not play audio',
        '',
      ].join('\n'),
    );
  });

  it('says so when the graphics adapter is unknown and keeps only the last lines, cut short', () => {
    const errors = Array.from({length: 25}, (_, index) => `ERROR ${index}`);
    const text = formatDiagnostics({
      ...INFO,
      graphics: [],
      errors: [...errors, `x${'y'.repeat(DIAGNOSTICS_LINE_LIMIT + 50)}`],
    });
    expect(text).toContain('Graphics: unknown');
    expect(text).toContain(`Last errors (${DIAGNOSTICS_ERROR_LINES}):`);
    expect(text).not.toContain('ERROR 10');
    expect(
      text.split('\n').every(line => line.length <= DIAGNOSTICS_LINE_LIMIT + 2),
    ).toBe(true);
  });
});

describe('what the text leaves out', () => {
  const HOME = String.raw`C:\Users\invented`;
  const DATA = String.raw`D:\LoveLight Data`;
  const folders = [
    {path: DATA, mask: '<app data>'},
    {path: HOME, mask: '~'},
  ];

  it('removes a folder in every way a log writes it, whatever the case', () => {
    const line = String.raw`ERROR could not open C:\Users\invented\a, c:/users/INVENTED/b, and "c:\USERS\invented\c"`;
    expect(withoutFolders(line, [{path: HOME, mask: '~'}])).toBe(
      String.raw`ERROR could not open ~\a, ~/b, and "~\c"`,
    );
    expect(withoutFolders('no path', [{path: '', mask: '~'}])).toBe('no path');
  });

  it('masks the app data folder too, with its own mark', () => {
    const line = String.raw`ERROR d:\lovelight data\Songs\x.llsong and C:\Users\invented\y`;
    expect(withoutFolders(line, folders)).toBe(
      String.raw`ERROR <app data>\Songs\x.llsong and ~\y`,
    );
  });

  it('keeps only ERROR lines of a log, the last ones, with the folders masked', () => {
    const log = [
      '2026 INFO started',
      String.raw`2026 ERROR first C:\Users\invented\x`,
      '2026 WARN slow',
      '2026 ERROR second',
    ].join('\n');
    expect(errorLinesOf(log, folders)).toEqual([
      String.raw`2026 ERROR first ~\x`,
      '2026 ERROR second',
    ]);
  });
});

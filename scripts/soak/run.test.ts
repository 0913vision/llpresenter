import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import {parseSoakArgs} from './run.mts';

describe('parseSoakArgs', () => {
  it('runs the app for 60 minutes by default', () => {
    expect(parseSoakArgs([])).toEqual({kind: 'run', minutes: 60});
  });

  it('takes a shorter run for a quick check', () => {
    expect(parseSoakArgs(['--minutes', '5'])).toEqual({
      kind: 'run',
      minutes: 5,
    });
  });

  it('judges an existing record by its absolute path', () => {
    expect(parseSoakArgs(['--judge', 'soak.jsonl'])).toEqual({
      kind: 'judge',
      recordPath: resolve('soak.jsonl'),
      minutes: 60,
    });
  });

  it.each([[['--minutes', '0']], [['--minutes', 'soon']], [['--fast']]])(
    'explains the usage for %j',
    args => {
      const command = parseSoakArgs(args);
      expect(command.kind).toBe('usage');
      expect(command.kind === 'usage' ? command.message : '').toMatch(/Usage:/);
    },
  );
});

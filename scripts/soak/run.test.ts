import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import {SOAK_MEDIA_ID} from './media.mts';
import {parseSoakArgs, soakEnvironment, withoutInspectorFlags} from './run.mts';

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

describe('soakEnvironment', () => {
  it('passes the run, the background, and the offscreen windows to the app', () => {
    const run = {
      userData: 'D:/tmp/llp-soak-1',
      recordPath: 'D:/tmp/llp-soak-1/soak.jsonl',
      durationMs: 1_200_000,
      mediaId: SOAK_MEDIA_ID,
    };
    expect(soakEnvironment(run, {PATH: 'C:/Windows'})).toEqual({
      PATH: 'C:/Windows',
      LLP_USER_DATA: 'D:/tmp/llp-soak-1',
      LLP_SOAK_RECORD: 'D:/tmp/llp-soak-1/soak.jsonl',
      LLP_SOAK_EXIT_MS: '1200000',
      LLP_SOAK_MEDIA_ID: SOAK_MEDIA_ID,
      LLP_TEST_WINDOWS: 'offscreen',
    });
  });
});

describe('withoutInspectorFlags', () => {
  it('drops every inspector flag and keeps the others', () => {
    expect(
      withoutInspectorFlags(
        '--max-old-space-size=4096 --inspect --inspect-brk=9229 --inspect-port=0.0.0.0:9230 --trace-warnings',
      ),
    ).toBe('--max-old-space-size=4096 --trace-warnings');
  });

  it('keeps a flag that only starts like one', () => {
    expect(withoutInspectorFlags('--inspection-mode')).toBe(
      '--inspection-mode',
    );
  });
});

describe('soakEnvironment without an inspector', () => {
  const run = {
    userData: 'D:/tmp/llp-soak-2',
    recordPath: 'D:/tmp/llp-soak-2/soak.jsonl',
    durationMs: 60_000,
    mediaId: SOAK_MEDIA_ID,
  };

  it('passes NODE_OPTIONS on without its inspector flags', () => {
    const env = soakEnvironment(run, {
      NODE_OPTIONS: '--inspect=9229 --max-old-space-size=4096',
    });
    expect(env['NODE_OPTIONS']).toBe('--max-old-space-size=4096');
  });

  it('leaves NODE_OPTIONS out when only inspector flags were in it', () => {
    const env = soakEnvironment(run, {node_options: '--inspect-brk'});
    expect(Object.keys(env).filter(name => /node_options/i.test(name))).toEqual(
      [],
    );
  });
});

import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import {SOAK_AUDIO_PLAYLIST_ID, SOAK_MEDIA_ID} from './media.mts';
import {judgeOptionsFor} from './judge.mts';
import {parseSoakArgs, soakEnvironment, soakJudgeOptions} from './run.mts';

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
      userData: 'C:/data/llp-soak-1',
      recordPath: 'C:/data/llp-soak-1/soak.jsonl',
      durationMs: 1_200_000,
      mediaId: SOAK_MEDIA_ID,
    };
    expect(soakEnvironment(run, {PATH: 'C:/Windows'})).toEqual({
      PATH: 'C:/Windows',
      LLP_USER_DATA: 'C:/data/llp-soak-1',
      LLP_SOAK_RECORD: 'C:/data/llp-soak-1/soak.jsonl',
      LLP_SOAK_EXIT_MS: '1200000',
      LLP_SOAK_MEDIA_ID: SOAK_MEDIA_ID,
      LLP_SOAK_AUDIO_PLAYLIST_ID: SOAK_AUDIO_PLAYLIST_ID,
      LLP_TEST_WINDOWS: 'offscreen',
    });
  });
});

describe('soakEnvironment without NODE_OPTIONS', () => {
  const run = {
    userData: 'C:/data/llp-soak-2',
    recordPath: 'C:/data/llp-soak-2/soak.jsonl',
    durationMs: 60_000,
    mediaId: SOAK_MEDIA_ID,
  };

  it.each([
    ['NODE_OPTIONS', '--inspect=9229 --max-old-space-size=4096'],
    ['node_options', '"--inspect=9229"'],
    ['Node_Options', '--require "C:/a  b/hook.js"'],
  ])('leaves out %s, whatever it holds', (name, value) => {
    const env = soakEnvironment(run, {[name]: value, PATH: 'C:/Windows'});
    expect(Object.keys(env).filter(key => /^node_options$/i.test(key))).toEqual(
      [],
    );
    expect(env['PATH']).toBe('C:/Windows');
  });
});

describe('soakJudgeOptions', () => {
  it('reports the GPU process of an offscreen run without judging it', () => {
    expect(soakJudgeOptions(20)).toEqual({
      ...judgeOptionsFor(20 * 60_000),
      reportedOnly: ['gpu'],
    });
  });
});

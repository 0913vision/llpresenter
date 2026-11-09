import {describe, expect, it} from 'vitest';
import {
  PLAYBACK_PROBLEM_LIMITS,
  parsePlaybackProblemReport,
  parsePlaybackProblems,
  parsePlaybackRetry,
} from '@core/schema/playbackProblems';

const problem = {
  source: 'audio',
  name: '오디오',
  kinds: ['playback'],
  renderer: 'running',
};

describe('playback problem payloads', () => {
  it('accepts current failures, recovery, and a bounded retry target', () => {
    expect(parsePlaybackProblems([problem]).ok).toBe(true);
    expect(parsePlaybackProblems([]).ok).toBe(true);
    expect(
      parsePlaybackProblemReport(['device-missing', 'device-failed']).ok,
    ).toBe(true);
    expect(parsePlaybackProblemReport([]).ok).toBe(true);
    expect(
      parsePlaybackProblemReport([
        'font-missing',
        'theme-missing',
        'media-missing',
      ]).ok,
    ).toBe(true);
    expect(parsePlaybackRetry({source: 'audio'}).ok).toBe(true);
  });

  it.each([null, {}, ['unknown'], ['playback', 'playback'], ['limited'], [1]])(
    'rejects invalid renderer reports %j',
    value => {
      expect(parsePlaybackProblemReport(value).ok).toBe(false);
    },
  );

  it('rejects malformed, duplicated, or oversized snapshots and targets', () => {
    for (const value of [
      [problem, problem],
      [{...problem, renderer: 'gone'}],
      [{...problem, name: 'x'.repeat(PLAYBACK_PROBLEM_LIMITS.name + 1)}],
      Array.from({length: PLAYBACK_PROBLEM_LIMITS.sources + 1}, (_, index) => ({
        ...problem,
        source: String(index),
      })),
    ]) {
      expect(parsePlaybackProblems(value).ok).toBe(false);
    }
    expect(parsePlaybackRetry({source: ''}).ok).toBe(false);
    expect(
      parsePlaybackRetry({source: 'x'.repeat(PLAYBACK_PROBLEM_LIMITS.id + 1)})
        .ok,
    ).toBe(false);
  });
});

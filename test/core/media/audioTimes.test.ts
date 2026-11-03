import {describe, expect, it} from 'vitest';
import {audioTimes, DEFAULT_AUDIO_TIMES} from '@core/media/audioTimes';
import {defaultPreferences} from '@core/schema/preferences';

describe('audioTimes', () => {
  it('starts at 0.5 s for a change and 3 s for a fade out', () => {
    expect(DEFAULT_AUDIO_TIMES).toEqual({transitionMs: 500, fadeOutMs: 3000});
  });

  it('turns the seconds of 환경설정 into milliseconds, 0 being a cut', () => {
    expect(
      audioTimes({
        show: {
          ...defaultPreferences.show,
          audio: {transitionSeconds: 0, fadeOutSeconds: 0.5},
        },
      }),
    ).toEqual({transitionMs: 0, fadeOutMs: 500});
  });
});

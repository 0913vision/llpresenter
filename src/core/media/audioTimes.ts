import {defaultPreferences, type Preferences} from '../schema/preferences';

/** How long audio takes to change and to fade out, in milliseconds; 0 is a cut. */
export interface AudioTimes {
  readonly transitionMs: number;
  readonly fadeOutMs: number;
}

/** The 오디오 전환 and 페이드 아웃 시간 of 환경설정. */
export function audioTimes(preferences: Pick<Preferences, 'show'>): AudioTimes {
  const {transitionSeconds, fadeOutSeconds} = preferences.show.audio;
  return {
    transitionMs: Math.round(transitionSeconds * 1000),
    fadeOutMs: Math.round(fadeOutSeconds * 1000),
  };
}

/** What 환경설정 says when nothing is stored. */
export const DEFAULT_AUDIO_TIMES: AudioTimes = audioTimes(defaultPreferences);

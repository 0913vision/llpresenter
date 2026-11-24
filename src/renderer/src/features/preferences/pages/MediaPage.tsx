import type {JSX} from 'react';
import {
  MEDIA_END_OPTIONS,
  PICTURE_FIT_OPTIONS,
} from '@renderer/ui/choices/mediaChoices';
import {PropertyGroup} from '@renderer/ui/panels/PropertyRow';
import {AUDIO_LIMITS} from '@core/schema/app/preferences';
import {CountRow, SegmentedRow, CheckboxRow} from '../PreferenceRows';
import {DeviceRow} from '../DeviceRow';
import type {useAudioOutputs} from '../useAudioOutputs';
import type {PageProps} from './pageProps';

/** 미디어: 새 미디어, 소리. */
export function MediaPage({
  edits,
  audioOutputs,
}: PageProps & {
  readonly audioOutputs: ReturnType<typeof useAudioOutputs>;
}): JSX.Element | null {
  const {preferences, lockedReason, change} = edits;
  const {devices, loading} = audioOutputs;
  if (preferences === null) return null;
  const disabled = lockedReason !== undefined;
  const {defaults} = preferences.media;
  const setDefaults = (changed: Partial<typeof defaults>): void =>
    change(stored => ({
      ...stored,
      media: {
        ...stored.media,
        defaults: {...stored.media?.defaults, ...changed},
      },
    }));
  const setAudio = (changed: {
    readonly transitionSeconds?: number;
    readonly fadeOutSeconds?: number;
  }): void =>
    change(stored => ({
      ...stored,
      show: {...stored.show, audio: {...stored.show?.audio, ...changed}},
    }));
  return (
    <>
      <PropertyGroup title="새 미디어">
        <SegmentedRow
          label="영상 끝나면"
          disabled={disabled}
          title={lockedReason}
          options={MEDIA_END_OPTIONS}
          value={defaults.end}
          onChange={end => setDefaults({end})}
        />
        <SegmentedRow
          label="맞춤"
          disabled={disabled}
          title={lockedReason}
          options={PICTURE_FIT_OPTIONS}
          value={defaults.fit}
          onChange={fit => setDefaults({fit})}
        />
        <CheckboxRow
          label="영상 소리"
          disabled={disabled}
          title={lockedReason}
          checked={defaults.audio}
          onChange={audio => setDefaults({audio})}
        />
      </PropertyGroup>
      <PropertyGroup title="소리">
        <DeviceRow
          label="출력 장치"
          disabled={disabled}
          title={lockedReason}
          choice={preferences.media.audioOutput}
          loading={loading}
          devices={devices}
          onChange={audioOutput =>
            change(stored => ({
              ...stored,
              media: {...stored.media, audioOutput},
            }))
          }
        />
        <DeviceRow
          label="미리 듣기 장치"
          disabled={disabled}
          title={lockedReason}
          choice={preferences.media.previewOutput}
          loading={loading}
          devices={devices}
          onChange={previewOutput =>
            change(stored => ({
              ...stored,
              media: {...stored.media, previewOutput},
            }))
          }
        />
        <CountRow
          label="오디오 겹치기"
          unit="초"
          disabled={disabled}
          title={lockedReason}
          value={preferences.show.audio.transitionSeconds}
          {...AUDIO_LIMITS.transition}
          onChange={transitionSeconds => setAudio({transitionSeconds})}
        />
        <CountRow
          label="페이드 아웃"
          unit="초"
          disabled={disabled}
          title={lockedReason}
          value={preferences.show.audio.fadeOutSeconds}
          {...AUDIO_LIMITS.fadeOut}
          onChange={fadeOutSeconds => setAudio({fadeOutSeconds})}
        />
      </PropertyGroup>
    </>
  );
}

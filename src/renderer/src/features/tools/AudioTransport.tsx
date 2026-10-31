import {audioPlayCommand} from '@core/media/audioPlayCommand';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import type {JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {AudioLayer} from '@core/live/state';
import type {AudioPlaylist, MediaItem} from '@core/schema/mediaList';
import {audioPositionSeconds} from '@core/schema/audioState';
import {Button, Slider, TruncatedText} from '@renderer/ui';
import {durationText} from '@renderer/features/media/mediaEntries';
import {useTimerNow} from './useTimerNow';
import styles from './AudioTransport.module.css';

export function AudioTransport({
  api,
  audio,
  items,
  selected,
  volume,
  firstPlayable = true,
}: {
  readonly api: LlpApi;
  readonly audio: AudioLayer | null;
  readonly items: readonly MediaItem[];
  readonly selected: AudioPlaylist | undefined;
  readonly volume: number;
  readonly firstPlayable?: boolean | undefined;
}): JSX.Element {
  const playback = audio?.playback;
  const running = playback !== undefined && playback.since !== null;
  const now = useTimerNow(api, running);
  const item = items.find(item => item.id === audio?.mediaId);
  const name = item?.name ?? '';
  const duration = item?.duration;
  const position = playback ? audioPositionSeconds(playback, now.timer) : 0;
  const shown =
    duration === undefined ? position : Math.min(position, duration);
  const play = (): void => {
    const command = audioPlayCommand({audio, selected, firstPlayable});
    if (command !== null) api.live.send(command);
  };

  useWindowShortcuts([
    {id: 'audio.playPause', run: play},
    ...(['next', 'previous', 'fadeOut'] as const).map(action => ({
      id: `audio.${action}`,
      run: () => {
        if (playback) api.live.send({type: `audio.${action}`});
      },
    })),
  ]);
  return (
    <div className={styles.root}>
      <div className={styles.reading}>
        <TruncatedText
          className={styles.name}
          text={name.length === 0 ? '재생 중인 오디오 없음' : name}
        />
        <span>
          {durationText(shown) ?? '0:00'} / {durationText(duration) ?? '—'}
        </span>
      </div>
      <progress
        aria-label="재생 위치"
        max={duration && duration > 0 ? duration : 1}
        value={duration && duration > 0 ? shown : 0}
      />
      <div className={styles.controls}>
        <Button
          disabled={!playback}
          onClick={() => api.live.send({type: 'audio.previous'})}
        >
          이전
        </Button>
        <Button
          disabled={!playback && (!selected?.items.length || !firstPlayable)}
          onClick={play}
        >
          {running ? '일시 정지' : '재생'}
        </Button>
        <Button
          disabled={!playback}
          onClick={() => api.live.send({type: 'audio.next'})}
        >
          다음
        </Button>
        <Button
          disabled={!playback}
          onClick={() => api.live.send({type: 'audio.fadeOut'})}
        >
          페이드 아웃
        </Button>
        <Slider
          label="음량"
          workspace="show"
          width="compact"
          min={0}
          max={100}
          value={volume}
          onChange={value =>
            api.live.send({type: 'audio.volume.set', volume: value})
          }
        />
      </div>
    </div>
  );
}

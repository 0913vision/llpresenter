import type {JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import {Icon, TruncatedText} from '@renderer/ui';
import {durationText} from '@renderer/prep/media/mediaEntries';
import type {AudioTrack} from '@core/media/audioTracks';
import styles from './AudioTrackRow.module.css';

export function AudioTrackRow({
  api,
  track,
}: {
  readonly api: LlpApi;
  readonly track: AudioTrack;
}): JSX.Element {
  const item = track.item;
  const name = item?.name ?? '';
  return (
    <button
      type="button"
      className={styles.row}
      disabled={track.missing}
      title={track.missing ? '오디오 파일을 찾을 수 없습니다' : undefined}
      onClick={() => api.live.send({type: 'audio.play', source: track.source})}
    >
      <span className={styles.number}>
        {track.playing ? <Icon name="wave" /> : track.position + 1}
      </span>
      <TruncatedText
        className={styles.name}
        text={name.length === 0 ? '이름 없음' : name}
      />
      <span className={styles.duration}>
        {durationText(item?.duration) ?? '—'}
      </span>
    </button>
  );
}

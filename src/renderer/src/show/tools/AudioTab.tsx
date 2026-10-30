import {useMemo, useState, type JSX} from 'react';
import {useLive} from '@renderer/platform/live';
import {SelectMenu, Switch} from '@renderer/ui';
import type {Notice} from '@renderer/ui/notices';
import type {AudioPlaylistId} from '@core/schema/ids';
import type {MediaItem} from '@core/schema/mediaList';
import {audioTracks} from '@core/media/audioTracks';
import {setAudioLoop} from './audioLoop';
import {AudioTransport} from './AudioTransport';
import {useAudioMedia} from './useAudioMedia';
import {useAudioMissing} from './useAudioMissing';
import {useToolEditing} from './useToolEditing';
import {WindowedAudioTracks} from './WindowedAudioTracks';
import styles from './AudioTab.module.css';

const NO_ITEMS: readonly MediaItem[] = [];

export function AudioTab({
  onProblem,
}: {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const api = window.llp;
  const document = useAudioMedia(onProblem);
  const missing = useAudioMissing(onProblem);
  const [chosen, setChosen] = useState<AudioPlaylistId | undefined>();
  const playlists = document?.value.audioPlaylists ?? [];
  const selected =
    playlists.find(playlist => playlist.id === chosen) ?? playlists[0];
  const audio = useLive(view => view.state?.layers.audio ?? null);
  const volume = useLive(view => view.state?.audioVolume ?? 100);
  const editing = useToolEditing({
    api,
    onProblem,
    write: (
      api,
      edit: {readonly id: AudioPlaylistId; readonly loop: boolean},
    ) => setAudioLoop(api, edit.id, edit.loop),
    area: {
      key: 'audio-loop',
      label: '반복',
      log: 'Could not update audio repeat',
    },
  });
  const items = document?.value.items ?? NO_ITEMS;
  const tracks = useMemo(
    () =>
      selected
        ? audioTracks(
            selected,
            items,
            audio?.playback?.since !== null
              ? audio?.playback?.source
              : undefined,
          ).map(track => ({
            ...track,
            missing:
              track.missing ||
              (track.item !== undefined && missing.has(track.item.id)),
          }))
        : [],
    [selected, items, audio, missing],
  );
  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <SelectMenu
          aria-label="오디오 재생목록"
          block
          value={selected?.id}
          disabled={playlists.length === 0}
          valueText={selected ? undefined : '재생목록 없음'}
          options={playlists.map(playlist => ({
            value: playlist.id,
            label: playlist.name || '이름 없음',
          }))}
          onChange={setChosen}
        />
        <span>{selected?.items.length ?? 0}곡</span>
        <label className={styles.repeat}>
          반복{' '}
          <Switch
            aria-label="반복"
            checked={selected?.loop ?? false}
            disabled={
              !selected || editing.busy || document?.access !== 'editable'
            }
            onChange={loop => {
              if (selected) {
                editing
                  .run({id: selected.id, loop})
                  .catch((cause: unknown) =>
                    console.error('Repeat callback failed:', cause),
                  );
              }
            }}
          />
        </label>
      </div>
      {api && selected ? (
        <WindowedAudioTracks key={selected.id} api={api} tracks={tracks} />
      ) : (
        <div className={styles.empty}>오디오 재생목록이 없습니다</div>
      )}
      {api ? (
        <AudioTransport
          api={api}
          audio={audio}
          selected={selected}
          items={items}
          volume={volume}
          firstPlayable={tracks[0]?.missing === false}
        />
      ) : null}
    </div>
  );
}

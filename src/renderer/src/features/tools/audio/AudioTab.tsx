import {useAudioSelection} from './useAudioSelection';
import {useMemo, type JSX} from 'react';
import {useLive} from '@renderer/session/live';
import {CheckRow} from '@renderer/ui/choices/Checkbox';
import {SelectMenu} from '@renderer/ui/choices/SelectMenu';
import type {Notice} from '@renderer/ui/popups/notices';
import type {MediaItem} from '@core/schema/media/mediaList';
import {audioTracks} from '@core/media';
import {useAudioLoopEditing} from './audioLoop';
import {AudioTransport} from './AudioTransport';
import {useMediaDocument} from '../useMediaDocument';
import {useAudioMissing} from './useAudioMissing';
import {WindowedAudioTracks} from './WindowedAudioTracks';
import styles from './AudioTab.module.css';

const NO_ITEMS: readonly MediaItem[] = [];

/**
 * The 오디오 tab of the 진행 tools: the audio playlists and the tracks of the chosen
 * one.
 */
export function AudioTab({
  onProblem,
}: {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const api = window.llp;
  const document = useMediaDocument(onProblem, 'audio');
  const missing = useAudioMissing(onProblem);
  const {chosen, setChosen} = useAudioSelection();
  const playlists = document?.value.audioPlaylists ?? [];
  const selected =
    playlists.find(playlist => playlist.id === chosen) ?? playlists[0];
  const audio = useLive(view => view.state?.layers.audio ?? null);
  const volume = useLive(view => view.state?.audioVolume ?? 100);
  const editing = useAudioLoopEditing(api, onProblem);
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
        <CheckRow
          label="반복"
          className={styles.repeat}
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
      </div>
      {api && selected ? (
        <WindowedAudioTracks key={selected.id} api={api} tracks={tracks} />
      ) : (
        <div className={styles.empty}>오디오 재생목록이 없습니다.</div>
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

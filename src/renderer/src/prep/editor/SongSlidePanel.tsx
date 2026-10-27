import {useState, useSyncExternalStore, type JSX} from 'react';
import {playbackOrder} from '@shared/songOrder';
import {isGroupedSong, slideCountOf} from './blockEdits';
import {
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
  PanelTitle,
} from '@renderer/ui/Panel';
import {ThumbnailSizeControl} from '@renderer/ui/ThumbnailSizeControl';
import {
  saveThumbnailScale,
  showThumbnailScale,
  useThumbnailScale,
} from '@renderer/state/thumbnailScale';
import {
  defaultThumbnailColumns,
  type SizeClass,
} from '@renderer/shell/sizeClass';
import type {SongEditorStore} from './songEditorStore';
import {VirtualSlides} from './VirtualSlides';
import styles from './SongPanels.module.css';

/** File/arrangement thumbnails select editor blocks without outputting. */
export function SongSlidePanel({
  store,
  sizeClass,
}: {
  readonly store: SongEditorStore;
  readonly sizeClass: SizeClass;
}): JSX.Element {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [pointed, setPointed] = useState<{
    songId: string;
    order: string | undefined;
    index: number;
  } | null>(null);
  const scale = useThumbnailScale(sizeClass);
  const session = state.session;
  if (session === null) {
    return (
      <Panel label="슬라이드">
        <PanelHeader>
          <PanelTitle title="슬라이드" />
        </PanelHeader>
      </Panel>
    );
  }
  const {song, selection} = session.history.snapshot;
  const numbers = isGroupedSong(song)
    ? Array.from({length: slideCountOf(song)}, (_, i) => i + 1)
    : playbackOrder(song, session.arrangement);
  const at =
    pointed !== null &&
    pointed.songId === song.id &&
    pointed.order === session.arrangement &&
    numbers[pointed.index] === selection.block + 1
      ? pointed.index
      : numbers.indexOf(selection.block + 1);
  return (
    <Panel label="슬라이드" className={styles.panel}>
      <PanelHeader>
        <PanelTitle title="슬라이드" meta={String(numbers.length)} />
      </PanelHeader>
      <PanelBody variant="flush">
        <VirtualSlides
          key={song.id}
          song={song}
          numbers={numbers}
          labels={state.labels?.value.labels ?? []}
          selected={at < 0 ? undefined : at}
          baseline={defaultThumbnailColumns[sizeClass]}
          scale={scale}
          onSelect={index => {
            const number = numbers[index];
            if (number === undefined) return;
            setPointed({songId: song.id, order: session.arrangement, index});
            session.select({block: number - 1, start: 0, end: 0});
          }}
        />
      </PanelBody>
      <PanelFooter
        end={
          <ThumbnailSizeControl
            value={scale}
            onChange={value => showThumbnailScale(sizeClass, value)}
            onCommit={value => saveThumbnailScale(sizeClass, value)}
          />
        }
      />
    </Panel>
  );
}
